import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

/* Call Open AI with first system message containing instructions and then the conversation for answer generation */
export const generateAnswerFromPrompt = async (prompt: string, relaunchEnabled: boolean) => {
  const instructions = `${process.env.AI_PERSONAL_INSTRUCTIONS}`;
  const contentForAnswerGen = `${!relaunchEnabled ? process.env.AI_CONV_ANSWER_USUAL : process.env.AI_CONV_RELAUNCH_BEGIN} ${
    process.env.AI_CONV_FORMAT_EXPLAIN
  } Here is the conversation : ${prompt} ${!relaunchEnabled ? process.env.AI_CONV_USUAL_END : process.env.AI_CONV_RELAUNCH_END}`;

  //console.log('[generateAnswerFromPrompt] instructions ', instructions);
  console.log('[generateAnswerFromPrompt] contentForAnswerGen ', contentForAnswerGen);

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: instructions,
      },
      {
        role: 'user',
        content: contentForAnswerGen,
      },
    ],
    model: process.env.OPEN_API_MODEL,
  });

  return completion.choices[0];
};

/* Call Open AI for first message to girl with here name */
export const generateFirstMessageForConv = async (girlName: string | null) => {
  const instructions = `${process.env.AI_PERSONAL_INSTRUCTIONS}. You are on a dating site and you have just matched ${girlName ? 'with ' + girlName : ''}  .`;
  let contentForAnswerGen = `Suggest a first opening sentence to start the conversation ${
    girlName ? 'with ' + girlName : ''
  }. In your proposal, use familiarity and be funny. Never use formality and try to be a little original.`;
  contentForAnswerGen = contentForAnswerGen + process.env.AI_CONV_FIRST_MSG_INSTRUCT_DETAILS;
  //La phrase d'accorche que tu propose doit obligatoirement inclure une question pour continuer à converser.

  //console.log('[generateAnswerFromPrompt] instructions ', instructions);
  console.log('[generateAnswerForNewConv] contentForAnswerGen ', contentForAnswerGen);

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: instructions,
      },
      {
        role: 'user',
        content: contentForAnswerGen,
      },
    ],
    model: process.env.OPEN_API_MODEL,
  });

  return completion.choices[0];
};
