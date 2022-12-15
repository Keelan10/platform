// NOTE: you must start your own Ulixee Miner to run this example.

import { Function, HeroFunctionPlugin } from '@ulixee/databox-plugins-hero';

export default new Function(async ctx => {
  const { input, output, hero } = ctx;
  input.url ??= 'https://ulixee.org';

  await hero.goto('https://ulixee.org');
  await hero.waitForPaintingStable();

  const { document } = hero;
  await document.querySelector('h1').textContent;

  // step 1 - look in dom
  const datasets = await document.querySelectorAll('.datasets .title');

  // step 2 - start collecting datasets
  output.datasets = [];
  for (const dataset of datasets) {
    output.datasets.push(await dataset.textContent);
  }

  // step 3 - look at the first one
  await hero.click(datasets[0]);
  await hero.waitForLocation('change');
}, HeroFunctionPlugin);
