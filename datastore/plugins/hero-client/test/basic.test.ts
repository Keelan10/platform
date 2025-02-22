import ConnectionFactory from '@ulixee/hero/connections/ConnectionFactory';
import Autorun from '@ulixee/datastore/lib/utils/Autorun';
import { Helpers } from '@ulixee/datastore-testing';
import { Runner } from '@ulixee/datastore';
import { HeroRunnerPlugin } from '../index';

import MockConnectionToHeroCore from './_MockConnectionToHeroCore';

afterAll(Helpers.afterAll);

function createConnectionToHeroCore() {
  return new MockConnectionToHeroCore(({ command, messageId: responseId }) => {
    if (command === 'Core.createSession') {
      return {
        responseId,
        data: { sessionId: 'session-id' },
      };
    }
    if (command === 'Session.getDetachedElements') {
      return {
        responseId,
        data: [],
      };
    }
    if (command === 'Session.getDetachedResources') {
      return {
        responseId,
        data: [],
      };
    }
    return { responseId, data: {} };
  });
}

describe('basic Datastore tests', () => {
  it('automatically runs and closes a datastore', async () => {
    const connection = createConnectionToHeroCore();
    jest.spyOn(ConnectionFactory, 'createConnection').mockImplementationOnce(() => connection);

    const ranScript = new Promise(resolve => {
      const runner = new Runner(async context => {
        await new context.Hero();
        resolve(true);
      }, HeroRunnerPlugin);
      Autorun.mainModuleExports = { runner };
    });
    await Autorun.attemptAutorun();
    await new Promise(resolve => process.nextTick(resolve));
    expect(await ranScript).toBe(true);

    const outgoingCommands = connection.outgoingSpy.mock.calls;
    expect(outgoingCommands.map(c => c[0].command)).toMatchObject([
      'Core.connect',
      'Core.createSession',
      'Session.close',
      'Core.disconnect',
    ]);
  });

  it('waits until run method is explicitly called', async () => {
    const connection = createConnectionToHeroCore();
    jest.spyOn(ConnectionFactory, 'createConnection').mockImplementationOnce(() => connection);
    const datastoreRunner = new Runner(async ({ Hero }) => {
      const hero = new Hero();
      await hero.goto('https://news.ycombinator.org');
      await hero.close();
    }, HeroRunnerPlugin);
    datastoreRunner.disableAutorun = true;
    expect(connection.outgoingSpy.mock.calls).toHaveLength(0);
    await datastoreRunner.runInternal({});
    const outgoingHeroCommands = connection.outgoingSpy.mock.calls;
    expect(outgoingHeroCommands.map(c => c[0].command)).toMatchObject([
      'Core.connect',
      'Core.createSession',
      'Tab.goto',
      'Session.close',
      'Core.disconnect',
    ]);
  });

  it('should call close on hero automatically', async () => {
    const connection = createConnectionToHeroCore();
    jest.spyOn(ConnectionFactory, 'createConnection').mockImplementationOnce(() => connection);
    const datastoreRunner = new Runner(async context => {
      const hero = new context.Hero();
      await hero.goto('https://news.ycombinator.org');
    }, HeroRunnerPlugin);
    datastoreRunner.disableAutorun = true;
    await datastoreRunner.runInternal({});

    const outgoingHeroCommands = connection.outgoingSpy.mock.calls;
    expect(outgoingHeroCommands.map(c => c[0].command)).toContain('Session.close');
  });

  it('should emit close hero on error', async () => {
    const connection = createConnectionToHeroCore();
    jest.spyOn(ConnectionFactory, 'createConnection').mockImplementationOnce(() => connection);
    const datastoreRunner = new Runner(async context => {
      const hero = new context.Hero();
      await hero.goto('https://news.ycombinator.org').then(() => {
        throw new Error('test');
      });

      await hero.interact('click');
    }, HeroRunnerPlugin);
    datastoreRunner.disableAutorun = true;

    await expect(datastoreRunner.runInternal({})).rejects.toThrowError();

    const outgoingHeroCommands = connection.outgoingSpy.mock.calls;
    expect(outgoingHeroCommands.map(c => c[0].command)).toContain('Session.close');
  });
});
