import { config } from 'dotenv';
config();

import NodeGeocoder from 'node-geocoder';
import puppeteer from 'puppeteer-extra';
import { getRandomInt, wait } from './helpers/util';
import { Tinder } from './tinder';
import { AccountType } from './types/main';

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export async function processAccountTinder(account: AccountType, location: string) {
  console.log('Starting browser...');
  const browser = await puppeteer.launch(<any>{
    args: [
      '--lang="fr-FR" --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.192 Safari/537.36"',
    ],
    userDataDir: `/tmp/browser-data-tinder-${account.name}`,
    headless: false,
  });

  const geocoder = NodeGeocoder({
    provider: 'google',
    apiKey: process.env.GOOGLE_API_KEY,
  });

  const coords = await geocoder.geocode(location);
  if (coords.length === 0) {
    throw Error('Failed to geocode.');
  }
  console.log('Geolocated to', coords[0].latitude, coords[0].longitude);

  const tinder = new Tinder(browser, coords[0].latitude, coords[0].longitude);
  await tinder.ready();
  console.log('Waiting for Tinder to be ready...');

  let nbLikes = 0;
  let nbPasses = 0;
  tinder.like$.subscribe(() => {
    nbLikes++;
    console.log('LIKE');
  });
  tinder.pass$.subscribe(() => {
    nbPasses++;
    console.log('PASS');
  });

  console.log('Starting work... ;)');
  /*   console.log('########### LIKING ###########');
  for (let i = 0; i < 25; i++) {
    if (await tinder.isOutOfLike()) break;
    await tinder.hidePopup();

    await wait(1000 + Math.random() * 3000);

    if (Math.random() > 0.4) await tinder.like();
    else await tinder.pass();

    await wait(1000);
  }
  console.log('########### LIKING END ###########');
  await wait(5000); */

  try {
    while (true) {
      //send messages to new matches
      //console.log('########### SENDING MESSAGES TO NEW MATCHES BEGIN ###########');
      for (let aNewMatch of tinder.newMatches) {
        //console.log('New match:', aNewMatch.person.name, aNewMatch.id);
        await tinder.gotoMatchAndSendFirstMessage(aNewMatch);
        await wait(3000);
      }
      //console.log('########### SENDING MESSAGES TO NEW MATCHES END  ###########');
      await wait(5000);

      //respond to existing convesations
      //console.log('########### RESPONDING TO EXISTING CONVERSATIONS BEGIN ###########');
      for (let anExistingMatch of tinder.existingMatchesWithConv.reverse()) {
        //console.log('Conversation:', anExistingMatch.person.name, anExistingMatch.id);
        if (!process.env.TINDER_BYPASS_CONV_IDS.includes(anExistingMatch.id)) await tinder.gotoConversationAndRespond(anExistingMatch);
        else console.log('BYPASSING CONV ID', anExistingMatch.id);
        await wait(3000);
      }
      //console.log('########### RESPONDING TO EXISTING CONVERSATIONS END ###########');
      await tinder.gotoGoogle();
      await wait(300000 + getRandomInt(0, 300000));
      await tinder.refreshMatchPage();
      await wait(5000);
    }
  } catch (e) {
    //rerun eveything if crashes
    processAccountTinder({ name: 'John' }, 'Paris, France');
  }

  await browser.close();

  console.log('Done.');
}

processAccountTinder({ name: 'John' }, 'Paris, France');
