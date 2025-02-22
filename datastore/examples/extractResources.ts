// NOTE: you must start your own Ulixee Miner to run this example.

import { Crawler, Datastore, Runner, HeroRunnerPlugin } from '@ulixee/datastore-plugins-hero';

const datastore = new Datastore({
  crawlers: {
    crawl: new Crawler(async ({ Hero }) => {
      const hero = new Hero();
      await hero.goto('https://ulixee.org');

      const resources = await hero.activeTab.waitForResources({ url: 'index.json' });
      for (const resource of resources) await resource.$addToDetachedResources('xhr');
      return hero;
    }, HeroRunnerPlugin),
  },
  runners: {
    extract: new Runner(async ({ HeroReplay, Output }) => {
      const heroReplay = await HeroReplay.fromCrawler(datastore.crawlers.crawl, {
        input: { maxTimeInCache: 24 * 60 * 60 },
      });
      const { detachedResources } = heroReplay;
      const xhrs = await detachedResources.getAll('xhr');

      console.log(xhrs);
      const output = new Output();
      output.gridsomeData = [];
      for (const xhr of xhrs) {
        // NOTE: synchronous APIs.
        const jsonObject = xhr.json;
        console.log(jsonObject);
        if (jsonObject.data) {
          output.gridsomeData.push(jsonObject.data);
        }
      }
    }, HeroRunnerPlugin),
  },
});

export default datastore;
