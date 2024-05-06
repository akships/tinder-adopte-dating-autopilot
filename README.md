# tinder-adopte-dating-autopilot

<video src="assets/demo-dating-autopilot.mp4" width="80%" height="80%" controls></video>

This is a dating bot that will automatically talk to matched girls on TINDER or ADOPTEUNMEC (french website).

### Main features

- send catchy first message to engage conv.
- reply to conversation using context and always asking a question for follow up
- don't send message if last one is not 24H old, then relaunch conv.
- ability to bypass some convs using ENV variable (take action and continue conv. yourself after BOT did the heavy lifting)
- ablity to change city when launching BOT (paid feature on tinder)

### BUILT WITH

- puppeteer, controlled browser and request interception as well as function injection
- typescript
- openai for message generation
- google api for geoloc. coordinates calculation

### HOW TO USE

1. Copy sample.env to .env and fill in required infos. (replace all [xxx] by personal infos), all keys with "XXXX" as placeholder are mandatory
2. Go to tinderBot.ts or adopteBot.ts and change `--lang="fr-FR"` to your language code (check codes in wikipedia). Search for `fr-FR` in other files and
   replace also.
3. In those same files go to bottom and change `processAccountTinder({ name: 'John' }, 'Paris, France')` to your name and the desired city
4. Install package with pnpm install
5. Launch with `pnpm tinder` or `pnpm adopte`

The first time the dating website is loaded you will have 60 seconds to login, after that the browser will not ask again (session data saved locally).

Feel free to improve and propose changes.

<br><br>

# DISCLAIMER

This project has been done for experimental purposes.
