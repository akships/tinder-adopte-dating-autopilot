const ADOPTE_DOMAIN = 'https://www.adopteunmec.com';
const ADOPTE_API_DOMAIN = 'https://api.adopteunmec.com';

import dayjs from 'dayjs';
import { Browser, Page } from 'puppeteer';
import { generateAnswerFromPrompt, generateFirstMessageForConv } from '../helpers/openApi';
import { injectFindElement, wait } from '../helpers/util';
import { AdopteThreadDetailsContainer } from './adopteThreadDetailsTypes';
import { AdopteThreadListContainer, ThreadList } from './adopteThreadListTypes';
import { adopte_createPromptFromMessages, adopte_isLastMessageFromMe, adopte_isLastMessageTooOld, adopte_isThreeLastMessagesFromMe } from './adopteUtils';

export class Adopte {
  private page: Page;
  public threadList: ThreadList[] = [];
  /* public threadDetails: ThreadDetails[] = []; */

  constructor(private browser: Browser, private latitude: number, private longitude: number) {
    const context = browser.defaultBrowserContext();
    context.overridePermissions(`${ADOPTE_DOMAIN}/`, ['geolocation']);
  }

  log(msg: string, val?: any) {
    console.log(`Adopte (${dayjs().format('DD/MM HH:mm:ss')}): ${msg}`, val);
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

    await this.page.goto(`${ADOPTE_DOMAIN}`, {
      waitUntil: 'networkidle0',
    });

    await wait(2000);

    await this.page.goto(`${ADOPTE_DOMAIN}/messages`, {
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
    }
  }

  /*

messages read -> https://api.adopteunmec.com/api/v4/threads/xxx?page[limit]=25&page[offset]=0&include=audio&filter[type]=xxx
messages new -> https://api.adopteunmec.com/api/v4/threads/xxx?page[limit]=25&page[offset]=0&include=audio&filter[type]=xxxx
current threads list -> https://api.adopteunmec.com/api/v4/threads?page[limit]=25&page[offset]=0&include=user&fields[user]=basic&spam=0

*/
  createListeners() {
    this.page.on('request', (request) => {
      request.continue().catch((e) => {});
    });

    this.page.on('response', async (response) => {
      const threadListUrl = `${ADOPTE_API_DOMAIN}/api/v4/threads?page[limit]=25&page[offset]=`;
      const threadDetailsUrl = `${ADOPTE_API_DOMAIN}/api/v4/threads/`;

      //api.gotinder.com/v2/suggestions?locale=fr&context_type=match&context_id=xxxx

      if (response.request().method() !== 'GET' || response.status() !== 200) return;

      /* current threads list */
      if (response.url().substr(0, threadListUrl.length) === threadListUrl) {
        try {
          const res: AdopteThreadListContainer = await response.json();
          const threadList = res.data;

          //DO IT ONLY ONCE BY EXEC OTHERWISE IT WILL ERASE MESSAGES FROM DETA
          //if (this.threadList.length === 0) {
          this.threadList = [...this.threadList, ...threadList];
          this.log('ThreadList intercept response', res.data.length + ' ' + this.threadList[0]?.messages?.length);
          //}
          //this.log('ThreadList intercept response', res.data);
        } catch (e) {
          this.log('Matches error', e);
        }
      }

      /* 
        thread details 
      */
      //api.adopteunmec.com/api/v4/threads/xxxx?page[limit]=25&page[offset]=0&include=audio&filter[type]=xxx
      //this.log('check', response.url().substr(0, threadDetailsUrl.length), threadDetailsUrl, response.url().includes('&include=audio&filter[type]'));
      if (response.url().substr(0, threadDetailsUrl.length) === threadDetailsUrl && response.url().includes('&include=audio&filter[type]')) {
        try {
          const res: AdopteThreadDetailsContainer = await response.json();
          if (res.data.length > 0) {
            const currentUserId = response.url().split(threadDetailsUrl)[1].split('?')[0];
            this.log(`Thread Details intercept response for ${currentUserId}`, res.data.length);
            this.threadList = this.threadList.map((aThread) => {
              if (aThread.relationships?.user?.data?.id === currentUserId) {
                aThread.messages = res.data;
              }
              //this.log('aThread messages ######@', aThread.messages);
              return aThread;
            });

            //this.log('New thread list after intercept ', this.threadList);
          } else {
            this.log('Thread Details intercept no details', res.data.length);
          }
        } catch (e) {
          this.log('MatchesMsg error', e);
        }
      }
    });
  }

  async gotoThreadAndSendMessage(aThread: ThreadList) {
    try {
      const currentThreadUid = aThread.relationships?.user?.data?.id;
      await this.page.goto(`${ADOPTE_DOMAIN}/messages/thread/${currentThreadUid}`, {
        waitUntil: 'networkidle0',
      });
      const injectRes = await injectFindElement(this.page);

      /*
      Waiting for 5 seconds is not enough to load the conversation last messages from request interception
      into this.threadList[x].messages that's why we refresh reference bellow 
    */
      await wait(5000);
      const getUpdatedThreadFromInstance = this.threadList.filter((aThreadToFilter) => aThreadToFilter.relationships?.user?.data?.id === currentThreadUid);
      const threadMessages = getUpdatedThreadFromInstance[0].messages;
      //this.log('[gotoThreadAndSendMessage] getUpdatedConversationFromInstance messages', threadMessages);

      //this means NEW MATCH = first message to send
      //console.log('aThread.attributes?.status', aThread.attributes?.status, threadMessages.length, threadMessages[0].attributes?.type);
      if (aThread.attributes?.status === 'new' && threadMessages.length === 1 /*&& threadMessages[0].attributes?.type === 'charm_accepted'*/) {
        const girlName = aThread.attributes?.title.split(' ')[0];
        this.log('[gotoThreadAndSendMessage] NEW MATCH', girlName);
        let firstMessage = await generateFirstMessageForConv(girlName);
        this.log('##################');
        this.log('FIRST MESSAGE IS ', firstMessage.message.content);
        this.log('##################\n');

        await this.page.type('textarea', firstMessage.message.content, { delay: 50 });

        const resSendMsgFromPoposal = await this.page.evaluate(() => {
          var sendProposalBtn: any = document.querySelector('#btn-send-message');
          if (sendProposalBtn) sendProposalBtn.click();
          return sendProposalBtn ? true : false;
        });

        this.log('resSendMsgFromPoposal', resSendMsgFromPoposal);

        return resSendMsgFromPoposal;
      }

      await wait(5000);

      const isThreeLastMessagesFromMeRes = adopte_isThreeLastMessagesFromMe(threadMessages);
      const isLastMessageTooOldRes = adopte_isLastMessageTooOld(threadMessages[0]); //CAREFULL MESSAGE ARE IN REVERSE ORDER !
      const isLastMessageFromMeRes = adopte_isLastMessageFromMe(threadMessages[0]);

      if (isThreeLastMessagesFromMeRes) {
        this.log('[gotoThreadAndSendMessage] ABORTED isThreeLastMessagesFromMeRes true');
        return false;
      }

      var promptRes: string;
      let relaunchMode = false;
      if (isLastMessageFromMeRes) {
        this.log('[gotoThreadAndSendMessage] isLastMessageFromMeRes true MAYBE RELAUNCH');
        if (isLastMessageTooOldRes) {
          this.log('[gotoThreadAndSendMessage] isLastMessageTooOldRes true RELAUNCH');
          promptRes = adopte_createPromptFromMessages(threadMessages);
          relaunchMode = true;
        } else {
          this.log('[gotoThreadAndSendMessage] ABORTED isLastMessageTooOldRes false TOO SOON NO RELAUNCH');
          /* 
        ACTIVATE FOR TESTING
        promptRes = createPromptFromMessages(matchMessages, false);
        relaunchMode = true; */
          return false;
        }
      } else {
        this.log('[gotoThreadAndSendMessage] isLastMessageFromMeRes false USUAL REPLY');
        promptRes = adopte_createPromptFromMessages(threadMessages);
      }

      this.log('[gotoThreadAndSendMessage] promptRes', promptRes);

      let possibleAnswer = await generateAnswerFromPrompt(promptRes, relaunchMode);
      this.log('##################');
      this.log('POSSIBLE ANSWER IS ', possibleAnswer.message.content);
      this.log('##################\n');

      await this.page.type('textarea', possibleAnswer.message.content, { delay: 100 });

      const resSendMsgFromPoposal = await this.page.evaluate(() => {
        var sendProposalBtn: any = document.querySelector('#btn-send-message');
        if (sendProposalBtn) sendProposalBtn.click();
        return sendProposalBtn ? true : false;
      });

      this.log('resSendMsgFromPoposal', resSendMsgFromPoposal);

      await wait(5000);

      return resSendMsgFromPoposal;
    } catch (e) {
      this.log('[gotoThreadAndSendMessage] error ', e);
      return false;
    }
  }

  isLoggedIn() {
    return this.page.url() === `${ADOPTE_DOMAIN}/messages`;
  }

  async gotoGoogle() {
    await this.page.goto(`https://www.google.com/`, {
      waitUntil: 'networkidle0',
    });
  }

  async refreshMsgPage() {
    await this.page.goto(`${ADOPTE_DOMAIN}/messages`, {
      waitUntil: 'networkidle0',
    });
  }
}
