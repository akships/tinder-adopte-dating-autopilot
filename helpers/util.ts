import dayjs from 'dayjs';
import { Page } from 'puppeteer';
import { Message } from '../types/tinder';
const fs = require('fs').promises; //for working with files

const maxPromptLength = 3000;

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const wait = (millis: number) => new Promise((resolve) => setTimeout(resolve, millis + getRandomInt(500, 2000)));

const randomItem = (array: ArrayLike<unknown>) => array[Math.floor(Math.random() * array.length)];

function injectFindElement(page: Page) {
  return page.evaluate(() => {
    (<any>window).findElement = (tag: string, text: string) => {
      const els = <any>document.querySelectorAll('*');
      for (let el of els) {
        if (el.innerHTML && el.innerHTML.toLowerCase() === text) {
          return el.tagName.toLowerCase() === tag ? el : el.closest(tag);
        }
      }
    };
    return true;
  });
}

//save cookie function
const saveCookie = async (page) => {
  const cookies = await page.cookies();
  const cookieJson = JSON.stringify(cookies, null, 2);
  await fs.writeFile('authStorage/cookies.json', cookieJson);
};

//load cookie function
const loadCookie = async (page) => {
  const cookieJson = await fs.readFile('authStorage/cookies.json');
  const cookies = JSON.parse(cookieJson);
  await page.setCookie(...cookies);
};

const saveLocalStorage = async (page) => {
  const localStorageData = await page.evaluate(() => {
    const json = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      json[key] = window.localStorage.getItem(key);
    }
    return json;
  });
  await fs.writeFile('authStorage/localStorage.json', JSON.stringify(localStorageData, null, 2));
};

const loadLocalStorage = async (page) => {
  console.log('loadLocalStorage called');
  const localStorageData = JSON.parse(await fs.readFile('authStorage/localStorage.json'));
  const resEval = await page.evaluate((localStorageData) => {
    for (let key in localStorageData) {
      console.log('setting ', key, localStorageData[key]);
      window.localStorage.setItem(key, localStorageData[key]);
    }
  });
  console.log('evaluate finished', resEval);
};

const createPromptFromMessages = (messages: Message[], lastMsgFromMeRelaunchOnly: boolean) => {
  let prompt = '';
  let promptLength = 0;

  messages.forEach((msg) => {
    const message = `#${msg.from === process.env.TINDER_USER_ID ? 'me' : 'girl'}: ##${msg.message}## `;
    if (promptLength + message.length <= maxPromptLength) {
      prompt = message + prompt;
      promptLength += message.length;
    } else {
      // Truncate the message if it exceeds the prompt length limit
      const remainingSpace = maxPromptLength - promptLength;
      prompt = message.slice(0, remainingSpace) + prompt;
      promptLength = maxPromptLength; // Update prompt length to limit further messages
      return; // Stop iterating through messages
    }
  });

  prompt = prompt.trim();

  return prompt;
};

const isThreeLastMessagesFromMe = (messages: Message[]) => {
  const msgL = messages.length;
  const nbMsgTocheck = 3;
  let nbMsgLastFromMe = 0;
  if (msgL >= nbMsgTocheck) {
    for (let i = 0; i < nbMsgTocheck; i++) {
      if (messages[i].from === process.env.TINDER_USER_ID) {
        nbMsgLastFromMe++;
      }
    }
    return nbMsgLastFromMe >= nbMsgTocheck;
  }

  return false;
};

const isLastMessageFromMe = (aMessage: Message) => {
  return aMessage.from === process.env.TINDER_USER_ID;
};

const isLastMessageTooOld = (aMessage: Message) => {
  //calculate number of days using dayjs
  const messageDate = dayjs(aMessage.sent_date);
  const today = dayjs();
  const days = today.diff(messageDate, 'day');
  //console.log('[isLastMessageTooOld] days since last message:', days);
  return days >= 2;
};

export {
  createPromptFromMessages,
  getRandomInt,
  injectFindElement,
  isLastMessageFromMe,
  isLastMessageTooOld,
  isThreeLastMessagesFromMe,
  loadCookie,
  loadLocalStorage,
  randomItem,
  saveCookie,
  saveLocalStorage,
  wait,
};
