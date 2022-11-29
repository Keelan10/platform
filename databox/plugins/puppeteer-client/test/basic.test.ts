import { Helpers } from '@ulixee/databox-testing';
import Autorun from '@ulixee/databox/lib/utils/Autorun';
import { Function, PuppeteerFunctionPlugin } from '../index';

afterAll(Helpers.afterAll);

describe('basic puppeteerFunction tests', () => {
  it('automatically runs and closes a function', async () => {
    const ranScript = new Promise(resolve => {
      Autorun.defaultExport = new Function(async ctx => {
        resolve(true);
      }, PuppeteerFunctionPlugin);
    });
    Autorun.defaultExport.disableAutorun = false;
    await Autorun.attemptAutorun(Function);
    await new Promise(resolve => process.nextTick(resolve));
    expect(await ranScript).toBe(true);
  });

  it('waits until run method is explicitly called', async () => {
    let hasCompleted = false;
    const puppeteerFunction = new Function(async ctx => {
      const { browser } = ctx;
      const page = await browser.newPage();
      await page.goto('https://example.org');
      await page.close();
      hasCompleted = true;
    }, PuppeteerFunctionPlugin);
    puppeteerFunction.disableAutorun = true;
    await puppeteerFunction.exec({});
    expect(hasCompleted).toBe(true);
  }, 30e3);

  it('should call close on puppeteer automatically', async () => {
    let closeSpy: jest.SpyInstance;
    const puppeteerFunction = new Function(async ctx => {
      closeSpy = jest.spyOn(ctx.browser, 'close');
      const page = await ctx.browser.newPage();
      await page.goto('https://example.org');
    }, PuppeteerFunctionPlugin);
    puppeteerFunction.disableAutorun = true;
    await puppeteerFunction.exec({});
    expect(closeSpy).toBeCalledTimes(1);
  });

  it('should emit close puppeteer on error', async () => {
    let closeSpy: jest.SpyInstance;
    const puppeteerFunction = new Function(async ctx => {
      closeSpy = jest.spyOn(ctx.browser, 'close');
      const browser = ctx.browser;
      const page = await browser.newPage();
      await page.goto('https://example.org').then(() => {
        throw new Error('testy');
      });
    }, PuppeteerFunctionPlugin);
    puppeteerFunction.disableAutorun = true;

    await expect(puppeteerFunction.exec({})).rejects.toThrowError('testy');
    expect(closeSpy).toBeCalledTimes(1);
  });
});
