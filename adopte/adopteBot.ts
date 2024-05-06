import { config } from 'dotenv';
config();

import NodeGeocoder from 'node-geocoder';
import puppeteer from 'puppeteer-extra';
import { getRandomInt, wait } from '../helpers/util';
import { AccountType } from '../types/main';
import { Adopte } from './adopte';

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function processAccount(account: AccountType, location: string) {
  console.log('Starting browser...');
  const browser = await puppeteer.launch(<any>{
    args: [
      '--lang="fr-FR" --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.192 Safari/537.36"',
    ],
    userDataDir: `/tmp/browser-data-adopte-${account.name}`,
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

  const adopte = new Adopte(browser, coords[0].latitude, coords[0].longitude);
  await adopte.ready();
  console.log('Waiting for Adopte to be ready...');

  console.log('Starting work... ;)');

  try {
    while (true) {
      console.log('######### NEW BATCH #########');
      for (let aThread of adopte.threadList) {
        console.log('Going to thread:', aThread?.attributes?.title, aThread.relationships?.user?.data?.id);
        if (!process.env.ADOPTE_BYPASS_USER_IDS.includes(aThread.relationships?.user?.data?.id)) await adopte.gotoThreadAndSendMessage(aThread);
        else console.log('BYPASSING USER ID', aThread.relationships?.user?.data?.id);
        await wait(3000);
      }
      await adopte.gotoGoogle();
      await wait(300000 + getRandomInt(0, 300000));
      await adopte.refreshMsgPage();
      await wait(5000);
    }
  } catch (e) {
    console.log('Main Exception relaunch', e);
    processAccount({ name: 'John' }, 'Paris, France');
  }
}

processAccount({ name: 'John' }, 'Paris, France');
