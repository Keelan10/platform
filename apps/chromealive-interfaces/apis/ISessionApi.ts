import type { IDomRecording } from '@ulixee/hero-core/models/DomChangesTable';
import IHeroMeta from '@ulixee/hero-interfaces/IHeroMeta';
import ISessionCreateOptions from '@ulixee/hero-interfaces/ISessionCreateOptions';
import ICommandUpdatedEvent from '../events/ICommandUpdatedEvent';
import IHeroSessionActiveEvent from '../events/IHeroSessionActiveEvent';
import IAppModeEvent from '../events/IAppModeEvent';
import ISessionSearchResult from '../ISessionSearchResult';

export interface ISessionResumeArgs extends IHeroSessionArgs {
  startLocation: ISessionCreateOptions['resumeSessionStartLocation'];
  startFromNavigationId?: number;
}

export interface IHeroSessionArgs {
  heroSessionId: string;
}

export default interface ISessionApi {
  getScreenshot(
    args: IHeroSessionArgs & {
      tabId: number;
      timestamp: number;
    },
  ): {
    imageBase64: string;
  };
  getDom(
    args?: IHeroSessionArgs & {
      tabId?: number;
    },
  ): Promise<
    IDomRecording & {
      framesById: { [id: number]: { parentId: number; domNodeId: number } };
    }
  >;
  getActive(args?: IHeroSessionArgs): IHeroSessionActiveEvent;
  getMeta(args?: IHeroSessionArgs): IHeroMeta;
  getScriptState(args?: IHeroSessionArgs & { tabId?: number }): Promise<{
    commandsById: Record<number, ICommandUpdatedEvent>;
    sourceFileLines: Record<string, string[]>;
  }>;
  quit(args: IHeroSessionArgs): Promise<void>;
  timetravel(
    args: IHeroSessionArgs & {
      commandId?: number;
      percentOffset?: number;
      timelinePercentRange?: [start: number, end: number];
      step?: 'forward' | 'back';
    },
  ): Promise<{
    timelineOffsetPercent: number;
  }>;
  openMode(
    args: IHeroSessionArgs & {
      mode: IAppModeEvent['mode'];
    },
  ): void;
  pause(args: IHeroSessionArgs): void;
  resume(args: ISessionResumeArgs): Promise<{
    success: boolean;
    error?: Error;
  }>;

  search(args: Partial<IHeroSessionArgs> & { query: string }): Promise<ISessionSearchResult>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/explicit-function-return-type
export function ISessionApiStatics(staticClass: ISessionApi) {}
