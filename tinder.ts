import dayjs from 'dayjs';
import { Browser, Page } from 'puppeteer';
import { Subject } from 'rxjs';
import { generateAnswerFromPrompt, generateFirstMessageForConv } from './helpers/openApi';
import { createPromptFromMessages, injectFindElement, isLastMessageFromMe, isLastMessageTooOld, isThreeLastMessagesFromMe, wait } from './helpers/util';
import { Match, TinderMatch } from './types/tinder';

const TINDER_DOMAIN = 'https://tinder.com';
const TINDER_API_DOMAIN = 'https://api.gotinder.com';

export class Tinder {
  private page: Page;
  public like$: Subject<null>;
  public pass$: Subject<null>;
  public nbMatches = 0;
  public nbMsgMatches = 0;
  public nbLikedMe = 0;
  public newMatches: Match[] = [];
  public existingMatchesWithConv: Match[] = [];

  constructor(private browser: Browser, private latitude: number, private longitude: number) {
    const context = browser.defaultBrowserContext();
    context.overridePermissions(`${TINDER_DOMAIN}/app/recs`, ['geolocation']);

    this.like$ = new Subject();
    this.pass$ = new Subject();
  }

  log(msg: string, val?: any) {
    console.log(`Tinder (${dayjs().format('DD/MM HH:mm:ss')}) : ${msg}`, val);
  }

  async ready() {
    this.page = await this.browser.newPage();
    await this.page.setGeolocation({
      latitude: this.latitude,
      longitude: this.longitude,
    });

    //this is to intercept the request also from service workers on tinder
    const client = await this.page.target().createCDPSession();
    await client.send('Network.enable'); // Must enable network.
    await client.send('Network.setBypassServiceWorker', { bypass: true });

    //request interception enabling
    await this.page.setRequestInterception(true);

    //setting browser's language
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'fr',
    });
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'language', {
        get: function () {
          return 'fr-FR';
        },
      });
      Object.defineProperty(navigator, 'languages', {
        get: function () {
          return ['fr-FR', 'fr'];
        },
      });
    });

    //process starts here
    this.createListeners();
    await this.page.goto(`${TINDER_DOMAIN}/app/recs`, {
      waitUntil: 'networkidle0',
    });

    await wait(5000);
    const injectRes = await injectFindElement(this.page);
    this.log('injectRes', injectRes);

    if (!this.isLoggedIn()) {
      this.log('Not logged in waiting 60s to login manually.');
      await wait(60000);
      this.log('Finished waiting logging in.');
    } else {
      this.log('Already logged in.');
      await wait(5000);
      //this.log('Saving sessions cookies and localStorage data for later use.');
      //await saveCookie(this.page);
      //await saveLocalStorage(this.page);
    }
  }

  /* 
    Interception of request for 
      - like, pass
      - matches list (contains only last conversation message)
      - matches list with messages (contains all (100) conversation messages except last one)
      - new matches list 
      - hidden liked me count 
  */
  createListeners() {
    this.page.on('request', (request) => {
      const likeUrl = `${TINDER_API_DOMAIN}/like`;
      const passUrl = `${TINDER_API_DOMAIN}/pass`;

      /* Don't load image to speed up the process and save bandwidth */
      //if (request.resourceType() === 'image') request.abort();

      if (request.method() === 'POST' && request.url().substr(0, likeUrl.length) === likeUrl) {
        const likedUserId = request.url().split(`${likeUrl}/`)[1]?.split('?')[0];
        this.log('LIKE REQUEST', likedUserId);
        this.like$.next(null);
      }
      if (request.method() === 'GET' && request.url().substr(0, passUrl.length) === passUrl) {
        const passedUserId = request.url().split(`${passUrl}/`)[1]?.split('?')[0];
        this.log('PASS REQUEST', passedUserId);
        this.pass$.next(null);
      }

      request.continue().catch((e) => {});
    });

    this.page.on('response', async (response) => {
      const matchesUrl = `${TINDER_API_DOMAIN}/v2/matches?locale=fr&count=60&message=0`;
      const msgMatchesUrl = `${TINDER_API_DOMAIN}/v2/matches?locale=fr&count=60&message=1`;
      const likedMeUrl = `${TINDER_API_DOMAIN}/v2/fast-match/teaser?locale=fr`;
      const existingMatchMessages = '/messages?locale=fr&count=100';

      if (response.request().method() !== 'GET' || response.status() !== 200) return;

      /*  NEW MATCHES LIST*/
      if (response.url().substr(0, matchesUrl.length) === matchesUrl) {
        try {
          const res: TinderMatch = await response.json();
          const matchesRes = res.data.matches;
          this.nbMatches = matchesRes.length;
          this.newMatches = matchesRes;
          //this.log('Matches intercept response', res.data.matches.length);
        } catch (e) {
          this.log('Matches error', e);
        }
      }

      /* MATCHES LIST WITH LAST CONVERSATION MESSAGE */
      if (response.url().substr(0, msgMatchesUrl.length) === msgMatchesUrl) {
        try {
          const res: TinderMatch = await response.json();
          this.nbMsgMatches = res.data.matches.length;
          this.existingMatchesWithConv = res.data.matches;
          //this.log('Msgs intercept response', res.data.matches.length);
        } catch (e) {
          this.log('MatchesMsg error', e);
        }
      }

      /* 
        MATCHES LIST WITH 100 LAST CONVERSATION MESSAGES
        We append those messages to already existing conversation in this.existingMatchesWithConv 
      */
      if (response.url().includes(existingMatchMessages)) {
        try {
          const res: any = await response.json();
          if (res.data.messages.length > 0) {
            const conversationId = res.data.messages[0].match_id;
            //this.log(`Conversation Messages intercept response for ${conversationId}`, res.data.messages.length);
            this.existingMatchesWithConv = this.existingMatchesWithConv.map((aMatch) => {
              if (aMatch.id === conversationId) {
                aMatch.messages = [...aMatch.messages, ...res.data.messages];
              }
              return aMatch;
            });
          } else {
            //this.log('Conversation Messages intercept no messages', res.data.messages.length);
          }
        } catch (e) {
          this.log('MatchesMsg error', e);
        }
      }

      /* GET NUMBER OF HIDDEN LIKED ME COUNT */
      if (response.url().substr(0, likedMeUrl.length) === likedMeUrl) {
        try {
          const res: any = await response.json();
          this.nbLikedMe = res.data.count;
          //this.log('LikedMe intercept response', res.data.count);
        } catch (e) {
          this.log('LikedMe error', e);
        }
      }
    });
  }

  isLoggedIn() {
    return this.page.url() !== `${TINDER_DOMAIN}/`;
  }

  isOutOfLike() {
    return this.page.evaluate(() => !!(<any>window).findElement('h3', "Vous n'avez plus de likes"));
  }

  hidePopup() {
    return this.page.evaluate(() => {
      var noThanksBtn = (<any>window).findElement('button', 'non merci');
      if (noThanksBtn) noThanksBtn.click();
      var maybeLaterBtn = (<any>window).findElement('button', 'peut-être plus tard');
      if (maybeLaterBtn) maybeLaterBtn.click();
      var notInterestedBtn = (<any>window).findElement('button', 'pas intéressé');
      if (notInterestedBtn) notInterestedBtn.click();
      var backToTinderBtn: any = document.querySelector('button[title="Revenir sur Tinder"');
      if (backToTinderBtn) backToTinderBtn.click();
    });
  }

  like() {
    return this.page.keyboard.press('ArrowRight');
  }

  pass() {
    return this.page.keyboard.press('ArrowLeft');
  }

  totalMatches() {
    return this.nbLikedMe + this.nbMatches + this.nbMsgMatches;
  }

  async refreshMatchPage() {
    await this.page.goto(`${TINDER_DOMAIN}/app/recs`, {
      waitUntil: 'networkidle0',
    });
  }

  async gotoGoogle() {
    await this.page.goto(`https://www.google.com/`, {
      waitUntil: 'networkidle0',
    });
  }

  async gotoMatchAndSendFirstMessage(aMatch: Match) {
    try {
      await this.page.goto(`${TINDER_DOMAIN}/app/messages/${aMatch.id}`, {
        waitUntil: 'networkidle0',
      });
      const injectRes = await injectFindElement(this.page);
      wait(5000);

      let firstMessage = await generateFirstMessageForConv(null);
      this.log('##################');
      this.log('FIRST MESSAGE IS ', firstMessage.message.content);
      this.log('##################\n');

      await this.page.type('textarea', firstMessage.message.content, { delay: 100 });

      const resSendMsgFromPoposal = await this.page.evaluate(() => {
        var sendProposalBtn: any = document.querySelector('button[type="submit"]');
        if (sendProposalBtn) sendProposalBtn.click();
        return sendProposalBtn ? true : false;
      });

      wait(5000);

      //this.log('[gotoMatchAndSendFirstMessage] resSendMsgFromPoposal', resSendMsgFromPoposal);

      return resSendMsgFromPoposal;
    } catch (e) {
      this.log('[gotoMatchAndSendFirstMessage] error ', e);
      return false;
    }
  }

  async gotoConversationAndRespond(aMatch: Match) {
    try {
      await this.page.goto(`${TINDER_DOMAIN}/app/messages/${aMatch.id}`, {
        waitUntil: 'networkidle0',
      });
      const injectRes = await injectFindElement(this.page);

      /*
      Waiting for 5 seconds is not enough to load the conversation last 100 messages from request interception
      into this.existingMatchesWithConv that's why we refresh reference bellow 
    */
      await wait(5000);
      const getUpdatedMatchFromInstance = this.existingMatchesWithConv.filter((aMatchToFilter) => aMatchToFilter.id === aMatch.id);
      const matchMessages = getUpdatedMatchFromInstance[0].messages;
      //this.log('[gotoConversationAndRespond] getUpdatedConversationFromInstance messages', matchMessages);

      const isThreeLastMessagesFromMeRes = isThreeLastMessagesFromMe(matchMessages);
      const isLastMessageTooOldRes = isLastMessageTooOld(matchMessages[0]); //CAREFULL MESSAGE ARE IN REVERSE ORDER !
      const isLastMessageFromMeRes = isLastMessageFromMe(matchMessages[0]);

      if (isThreeLastMessagesFromMeRes) {
        this.log('[gotoConversationAndRespond] ABORTED isThreeLastMessagesFromMeRes true');
        return false;
      }

      var promptRes: string;
      let relaunchMode = false;
      if (isLastMessageFromMeRes) {
        this.log('[gotoConversationAndRespond] isLastMessageFromMeRes true MAYBE RELAUNCH');
        if (isLastMessageTooOldRes) {
          this.log('[gotoConversationAndRespond] isLastMessageTooOldRes true RELAUNCH');
          promptRes = createPromptFromMessages(matchMessages, true);
          relaunchMode = true;
        } else {
          this.log('[gotoConversationAndRespond] ABORTED isLastMessageTooOldRes false TOO SOON NO RELAUNCH');
          /* 
        ACTIVATE FOR TESTING
        promptRes = createPromptFromMessages(matchMessages, false);
        relaunchMode = true; */
          return false;
        }
      } else {
        //this.log('[gotoConversationAndRespond] isLastMessageFromMeRes false USUAL REPLY');
        promptRes = createPromptFromMessages(matchMessages, false);
      }

      //this.log('[gotoConversationAndRespond] promptRes', promptRes);

      let possibleAnswer = await generateAnswerFromPrompt(promptRes, relaunchMode);
      this.log('##################');
      this.log('POSSIBLE ANSWER IS ', possibleAnswer.message.content);
      this.log('##################\n');

      await this.page.type('textarea', possibleAnswer.message.content, { delay: 100 });

      const resSendMsgFromPoposal = await this.page.evaluate(() => {
        var sendProposalBtn: any = document.querySelector('button[type="submit"]');
        if (sendProposalBtn) sendProposalBtn.click();
        return sendProposalBtn ? true : false;
      });

      this.log('resSendMsgFromPoposal', resSendMsgFromPoposal);

      await wait(5000);

      return resSendMsgFromPoposal;
    } catch (e) {
      this.log('[gotoConversationAndRespond] error ', e);
      return false;
    }
  }
}
