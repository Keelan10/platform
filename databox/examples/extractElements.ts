// NOTE: you must start your own Ulixee Miner to run this example.

import { Crawler, Databox, Function, HeroFunctionPlugin } from '@ulixee/databox-plugins-hero';
import { string } from '@ulixee/schema';

const crawl = new Crawler(
  {
    async run({ Hero, input }) {
      const hero = new Hero();
      await hero.goto(input.url);
      const h1 = await hero.querySelector('h1').$waitForVisible();
      // Extract the DOM Element at this moment in time.
      await h1.$addToDetachedElements('h1');
      return hero;
    },
    disableCache: false,
    schema: {
      input: {
        url: string({ format: 'url' }),
      },
    },
  },
  HeroFunctionPlugin,
);

const databox = new Databox({
  crawlers: {
    crawl,
  },
  functions: {
    extract: new Function(async ({ HeroReplay, Output }) => {
      const lastRun = await databox.crawl('crawl', {
        url: 'https://ulixee.org',
      });

      const heroReplay = new HeroReplay(lastRun);
      const h1 = await heroReplay.detachedElements.get('h1');
      // NOTE: synchronous APIs. No longer running in browser.
      const output = new Output();
      output.text = h1.textContent;
      const divs = h1.querySelectorAll('div');
      output.divs = { count: divs.length, textLengths: [...divs].map(x => x.textContent.length) };
      console.log(output);
    }, HeroFunctionPlugin),
  },
});

export default databox;
