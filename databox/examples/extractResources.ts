// NOTE: you must start your own Ulixee Server to run this example.

import Databox from '@ulixee/databox-for-hero';

export default new Databox({
  async run({ hero }) {
    await hero.goto('https://ulixee.org');

    const resources = await hero.activeTab.waitForResources({ url: 'index.json' });
    for (const resource of resources) await resource.$detach('xhr');
  },
  async onAfterHeroCompletes({ heroReplay, output }) {
    const { detachedResources } = heroReplay;
    const xhrs = await detachedResources.getAll('xhr');
    output.gridsomeData = [];
    console.log(xhrs);
    for (const xhr of xhrs) {
      // NOTE: synchronous APIs.
      const jsonObject = xhr.json;
      console.log(jsonObject);
      if (jsonObject.data) {
        output.gridsomeData.push(jsonObject.data);
      }
    }
  },
});
