import ISessionApi, {
  ISessionApiStatics,
  IHeroSessionArgs,
  ISessionResumeArgs,
} from '@ulixee/apps-chromealive-interfaces/apis/ISessionApi';
import { CanceledPromiseError } from '@ulixee/commons/interfaces/IPendingWaitEvent';
import SessionObserver from '../lib/SessionObserver';
import ChromeAliveCore from '../index';

@ISessionApiStatics
export default class SessionApi {
  static getScreenshot(): {
    imageBase64: string;
  } {
    return { imageBase64: null };
  }

  static async quit(args: Parameters<ISessionApi['quit']>[0]): Promise<void> {
    const sessionObserver = getObserver(args);
    await sessionObserver.heroSession.close(true);
  }

  static getScriptState(
    args?: Parameters<ISessionApi['getScriptState']>[0],
  ): ReturnType<ISessionApi['getScriptState']> {
    const sessionObserver = getObserver(args);

    return Promise.resolve(sessionObserver.sourceCodeTimeline.getCurrentState());
  }

  static getDom(args?: Parameters<ISessionApi['getDom']>[0]): ReturnType<ISessionApi['getDom']> {
    const sessionObserver = getObserver(args);
    return sessionObserver.getDomRecording(args?.tabId);
  }

  static getMeta(args: Parameters<ISessionApi['getMeta']>[0]): ReturnType<ISessionApi['getMeta']> {
    const sessionObserver = getObserver(args);
    return sessionObserver.heroSession.meta;
  }

  static getActive(
    args: Parameters<ISessionApi['getActive']>[0],
  ): ReturnType<ISessionApi['getActive']> {
    const sessionObserver = getObserver(args);
    return sessionObserver.getHeroSessionEvent();
  }

  static async timetravel(args: Parameters<ISessionApi['timetravel']>[0]): Promise<{
    timelineOffsetPercent: number;
  }> {
    const sessionObserver = getObserver(args);
    try {
      return await sessionObserver.timetravel(args);
    } catch (err) {
      if (err instanceof CanceledPromiseError) {
        return { timelineOffsetPercent: 100 };
      }
      throw err;
    }
  }

  static openMode(args: Parameters<ISessionApi['openMode']>[0]): void {
    const sessionObserver = getObserver(args);
    sessionObserver
      .openMode(args.mode)
      .catch(err => console.error('ERROR opening player mode %s', args.mode, err));
  }

  static step(args: IHeroSessionArgs): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const observer = getObserver(args);

    // observer.heroSession.commands.pause();
  }

  static async resume(args: ISessionResumeArgs): Promise<{
    success: boolean;
    error?: Error;
  }> {
    const observer = getObserver(args);

    const error = await observer.relaunchSession(args.startLocation, args.startFromNavigationId);

    return {
      success: !error,
      error,
    };
  }
}

function getObserver(args?: IHeroSessionArgs): SessionObserver {
  const sessionId = args?.heroSessionId ?? ChromeAliveCore.activeHeroSessionId;
  if (!sessionId || !ChromeAliveCore.sessionObserversById.has(sessionId))
    throw new Error(`No active session found - sessionId: "${sessionId}"`);

  return ChromeAliveCore.sessionObserversById.get(sessionId);
}
