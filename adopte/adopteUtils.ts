import dayjs from 'dayjs';
import { ThreadDetails } from './adopteThreadDetailsTypes';

const maxPromptLength = 3000;

const adopte_isThreeLastMessagesFromMe = (messages: ThreadDetails[]) => {
  if (!messages) return false;

  const msgL = messages.length;
  const nbMsgTocheck = 3;
  let nbMsgLastFromMe = 0;
  if (msgL >= nbMsgTocheck) {
    for (let i = 0; i < nbMsgTocheck; i++) {
      if (messages[i].attributes?.from === process.env.ADOPTE_USER_ID) {
        nbMsgLastFromMe++;
      }
    }
    return nbMsgLastFromMe >= nbMsgTocheck;
  }

  return false;
};

const adopte_isLastMessageFromMe = (aThreadMsg: ThreadDetails) => {
  return aThreadMsg?.attributes?.from === process.env.ADOPTE_USER_ID;
};

const adopte_isLastMessageTooOld = (aThreadMsg: ThreadDetails) => {
  //calculate number of days using dayjs
  const messageDate = dayjs.unix(aThreadMsg?.attributes?.date);
  const today = dayjs();
  const days = today.diff(messageDate, 'day');
  //console.log('[isLastMessageTooOld] days since last message:', days);
  return days >= 2;
};

const adopte_createPromptFromMessages = (messages: ThreadDetails[]) => {
  let prompt = '';
  let promptLength = 0;

  messages.forEach((msg) => {
    const message = `#${msg?.attributes?.from === process.env.ADOPTE_USER_ID ? 'me' : 'girl'}: ##${msg?.attributes?.content}## `;
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

export { adopte_createPromptFromMessages, adopte_isLastMessageFromMe, adopte_isLastMessageTooOld, adopte_isThreeLastMessagesFromMe };
