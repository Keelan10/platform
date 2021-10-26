import HeroCore, { GlobalPool as HeroGlobalPool, Session as HeroSession } from '@ulixee/hero-core';
import IChromeAliveEvents from '@ulixee/apps-chromealive-interfaces/events';
import Log from '@ulixee/commons/lib/Logger';
import { ChildProcess } from 'child_process';
import launchChromeAlive from '@ulixee/apps-chromealive/index';
import type Puppet from '@ulixee/hero-puppet';
import IDevtoolsSession from '@ulixee/hero-interfaces/IDevtoolsSession';
import { bindFunctions } from '@ulixee/commons/lib/utils';
import { IPuppetPage } from '@ulixee/hero-interfaces/IPuppetPage';
import HeroCorePlugin from './lib/HeroCorePlugin';
import SessionObserver from './lib/SessionObserver';
import ConnectionToClient from './lib/ConnectionToClient';
import AliveBarPositioner from './lib/AliveBarPositioner';
import FocusedWindowModule from './lib/hero-plugin-modules/FocusedWindowModule';

const { log } = Log(module);

export default class ChromeAliveCore {
  public static sessionObserversById = new Map<string, SessionObserver>();
  public static get activeSessionObserver(): SessionObserver {
    return this.sessionObserversById.get(this.activeHeroSessionId);
  }

  public static activeHeroSessionId: string;
  private static isTimetravelActive = false;
  private static connections: ConnectionToClient[] = [];
  private static shouldAutoShowBrowser = false;
  private static app: ChildProcess;
  private static coreServerAddress?: Promise<string>;

  public static setCoreServerAddress(address: Promise<string>) {
    this.coreServerAddress = address;
    this.launchApp(true).catch(err => {
      console.error('Cannot launch ChromeAlive app', err);
    });
  }

  public static addConnection(): ConnectionToClient {
    const connection = new ConnectionToClient();
    this.connections.push(connection);
    this.onWsConnected();
    connection.on('close', () => {
      const idx = this.connections.indexOf(connection);
      if (idx >= 0) this.connections.splice(idx, 1);
    });
    return connection;
  }

  public static register(isNodeRegisteredModule = false) {
    log.info('Registering ChromeAlive!');
    if (isNodeRegisteredModule === true) {
      this.shouldAutoShowBrowser = true;
    }

    bindFunctions(this);

    HeroGlobalPool.events.on('browser-launched', this.onNewBrowser);
    HeroGlobalPool.events.on('all-browsers-closed', this.hideApp);
    HeroGlobalPool.events.on('session-created', this.onHeroSessionCreated);
    HeroGlobalPool.events.on('browser-has-no-open-windows', this.onBrowserHasNoWindows);

    FocusedWindowModule.onVisibilityChange = this.changeActiveSessions;
    AliveBarPositioner.getSessionDevtools = this.getSessionDevtools;

    HeroCore.use(HeroCorePlugin);
  }

  public static shutdown() {
    log.info('Shutting down ChromeAlive!');
    this.closeApp();
    HeroGlobalPool.events.off('browser-launched', this.onNewBrowser);
    HeroGlobalPool.events.off('all-browsers-closed', this.hideApp);
    HeroGlobalPool.events.off('session-created', this.onHeroSessionCreated);
    HeroGlobalPool.events.off('browser-has-no-open-windows', this.onBrowserHasNoWindows);
    while (this.connections.length) {
      const next = this.connections.shift();
      next.close();
    }
    for (const observer of this.sessionObserversById.values()) {
      observer.close();
    }
    this.sessionObserversById.clear();
  }

  public static getActivePuppetPage(): IPuppetPage {
    if (!this.activeHeroSessionId) return;
    const sessionObserver = this.sessionObserversById.get(this.activeHeroSessionId);
    if (!sessionObserver) return;

    const { heroSession } = sessionObserver;
    const page = [...heroSession.tabsById.values()].find(x => !x.isClosing)?.puppetPage;
    return page;
  }

  private static onHeroSessionCreated(event: { session: HeroSession }): Promise<any> {
    const { session: heroSession } = event;

    const script = heroSession.options.scriptInstanceMeta?.entrypoint;
    if (!script) return;

    if (heroSession.mode === 'multiverse') {
      const observer = this.sessionObserversById.get(this.activeHeroSessionId);
      observer?.onMultiverseSession(heroSession);
      return;
    }

    if (heroSession.mode === 'development') {
      heroSession.configureHeaded({ showBrowser: true });
      heroSession.options.sessionKeepAlive = true;
      heroSession.options.viewport ??= { width: 0, height: 0 };
    }
    // if not auto-registered, check if browser is showing
    if (!heroSession.options.showBrowser) return;

    log.info('New Hero Session Created: %s (%s)', {
      script: script.split('/').pop(),
      sessionId: heroSession.id,
    });
    // keep alive session
    heroSession.options.sessionKeepAlive = true;
    const sessionObserver = new SessionObserver(heroSession);
    this.sessionObserversById.set(heroSession.id, sessionObserver);
    sessionObserver.on('hero:updated', this.sendActiveSession.bind(this, heroSession.id));
    sessionObserver.on('databox:updated', this.sendDataboxUpdatedEvent.bind(this, heroSession.id));
    sessionObserver.on('closed', this.onHeroSessionClosed.bind(this, heroSession.id));

    this.sendActiveSession(heroSession.id);

    if (!this.activeHeroSessionId) {
      this.sendEvent('Session.loading');
      this.sendEvent('App.show');
      sessionObserver.once('hero:updated', () => this.sendEvent('Session.loaded'));
      this.activeHeroSessionId = heroSession.id;
    }
  }

  private static onWsConnected() {
    log.info('ChromeAlive! Ws Connected', {
      sessionId: this.activeHeroSessionId,
    });
    if (this.activeHeroSessionId) {
      this.sendActiveSession(this.activeHeroSessionId);
      this.sendDataboxUpdatedEvent(this.activeHeroSessionId);
    }
  }

  private static onHeroSessionClosed(heroSessionId: string) {
    const sessionObserver = this.sessionObserversById.get(heroSessionId);
    if (!sessionObserver) return;
    this.sessionObserversById.delete(heroSessionId);
    sessionObserver.close();
    if (this.activeHeroSessionId === heroSessionId) {
      this.activeHeroSessionId = null;
      this.sendEvent('Session.active', null);
      this.sendEvent('Databox.updated', {
        changes: [],
        output: null,
        input: null,
        bytes: 0,
      });
      this.toggleAppVisibility(false);
    }
  }

  private static sendActiveSession(heroSessionId: string) {
    const sessionObserver = this.sessionObserversById.get(heroSessionId);
    if (!sessionObserver) return;
    this.sendEvent('Session.active', sessionObserver.getHeroSessionEvent());
  }

  private static sendDataboxUpdatedEvent(heroSessionId: string) {
    const sessionObserver = this.sessionObserversById.get(heroSessionId);
    if (!sessionObserver) return;
    this.sendEvent('Databox.updated', sessionObserver.getDataboxEvent());
  }

  private static async changeActiveSessions(
    status: { focused: boolean; active: boolean },
    heroSessionId: string,
    pageId: string,
  ): Promise<void> {
    const isPageVisible = status.active;
    log.info('Changing active session', { isPageVisible, sessionId: heroSessionId, pageId });
    const sessionObserver = this.sessionObserversById.get(heroSessionId);
    if (!sessionObserver) return;

    const isTimetravelTab = sessionObserver.timeline.isTimetravelTab(pageId) ?? false;
    const isClosedTimetravelTab = isTimetravelTab && !isPageVisible;
    const wasTimetravelActive = this.isTimetravelActive;
    this.isTimetravelActive = isTimetravelTab && isPageVisible;

    const didFocusOnLiveTab = !isTimetravelTab && isPageVisible;
    const didCloseLiveTab = !isTimetravelTab && !isPageVisible;
    const isActiveSession = this.activeHeroSessionId === heroSessionId;

    if (isActiveSession) {
      if (isClosedTimetravelTab) return;
      if (didCloseLiveTab) this.activeHeroSessionId = null;

      // if replay is opened and this tab is not a replay tab, close replay!
      if (didFocusOnLiveTab && wasTimetravelActive) {
        await sessionObserver.closeTimetravel();
      }
    } else {
      this.activeHeroSessionId = heroSessionId;
    }

    if (status.focused === false) {
      this.toggleAppTop(status.focused);
    } else {
      this.toggleAppVisibility(!!this.activeHeroSessionId);
    }
  }

  private static getSessionDevtools(heroSessionId: string): IDevtoolsSession {
    const sessionObserver = this.sessionObserversById.get(heroSessionId);
    if (!sessionObserver) return;

    const { heroSession } = sessionObserver;
    const page = [...heroSession.tabsById.values()].find(x => !x.isClosing)?.puppetPage;
    return page?.devtoolsSession;
  }

  private static async launchApp(hideOnLaunch = false): Promise<void> {
    if (this.app && !this.app.killed) return;

    const args: string[] = hideOnLaunch ? ['--hide'] : [];
    if (this.coreServerAddress) {
      args.push(`--coreServerAddress=${await this.coreServerAddress}`);
    }

    this.app = launchChromeAlive(...args);
    this.app.once('exit', () => (this.app = null));
    this.app.once('close', () => (this.app = null));
    log.info('Launched Electron App', {
      file: this.app?.spawnfile,
      args: this.app?.spawnargs,
      sessionId: null,
    });
  }

  private static onBrowserHasNoWindows(event: { puppet: Puppet }) {
    const browserId = event.puppet.browserId;
    setTimeout(() => {
      const sessionsUsingEngine = HeroSession.sessionsWithBrowserId(browserId);
      const hasWindows = sessionsUsingEngine.some(x => x.tabsById.size > 0);
      if (!hasWindows) {
        return event.puppet.close();
      }
    }, 2e3).unref();
  }

  private static async onNewBrowser(): Promise<void> {
    await this.launchApp();
  }

  private static hideApp(): void {
    this.toggleAppVisibility(false);
  }

  private static closeApp(): void {
    log.stats('Closing Electron App');
    this.sendEvent('App.quit');
    this.app?.send('exit');
    this.app?.kill('SIGTERM');
    this.app = null;
  }

  private static toggleAppTop(isFocused: boolean): void {
    this.sendEvent('App.onTop', isFocused);
  }

  private static toggleAppVisibility(show: boolean): void {
    if (show) {
      this.sendEvent('App.show');
    } else {
      this.sendEvent('App.hide');
    }
  }

  private static sendEvent<T extends keyof IChromeAliveEvents>(
    eventType: T,
    data: IChromeAliveEvents[T] = null,
  ) {
    for (const connection of this.connections) {
      connection.sendEvent({ eventType, data });
    }
  }
}
