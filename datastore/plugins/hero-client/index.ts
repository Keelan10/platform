// eslint-disable-next-line max-classes-per-file
import '@ulixee/commons/lib/SourceMapSupport';
import Hero, { HeroReplay, IHeroCreateOptions, IHeroReplayCreateOptions } from '@ulixee/hero';
import ICoreSession, { IOutputChangeToRecord } from '@ulixee/hero/interfaces/ICoreSession';
import FunctionInternal from '@ulixee/datastore/lib/FunctionInternal';
import { InternalPropertiesSymbol } from '@ulixee/hero/lib/internal';
import IFunctionSchema from '@ulixee/datastore/interfaces/IFunctionSchema';
import IObservableChange from '@ulixee/datastore/interfaces/IObservableChange';
import {
  Crawler,
  FunctionPluginStatics,
  IFunctionComponents,
  IFunctionExecOptions,
} from '@ulixee/datastore';
import IFunctionContextBase from '@ulixee/datastore/interfaces/IFunctionContext';
import ICrawlerOutputSchema from '@ulixee/datastore/interfaces/ICrawlerOutputSchema';

export * from '@ulixee/datastore';

const pkg = require('./package.json');

export type IHeroFunctionExecOptions<ISchema> = IFunctionExecOptions<ISchema> & IHeroCreateOptions;

declare module '@ulixee/hero/lib/extendables' {
  interface Hero {
    toCrawlerOutput(): Promise<ICrawlerOutputSchema>;
  }
}

export type HeroReplayCrawler = typeof HeroReplay & {
  new (options: IHeroReplayCreateOptions | ICrawlerOutputSchema): HeroReplay;
  fromCrawler<T extends Crawler>(crawler: T, options?: T['runArgsType']): Promise<HeroReplay>;
};

export type IHeroFunctionContext<ISchema> = IFunctionContextBase<ISchema> & {
  Hero: typeof Hero;
  HeroReplay: HeroReplayCrawler;
};

export type IHeroFunctionComponents<ISchema> = IFunctionComponents<
  ISchema,
  IHeroFunctionContext<ISchema>
>;

@FunctionPluginStatics
export class HeroFunctionPlugin<ISchema extends IFunctionSchema> {
  public static execArgAddons: IHeroCreateOptions;
  public static contextAddons: {
    Hero: typeof Hero;
    HeroReplay: HeroReplayCrawler;
  };

  public name = pkg.name;
  public version = pkg.version;
  public hero: Hero;
  public heroReplays = new Set<HeroReplay>();

  public functionInternal: FunctionInternal<ISchema, IHeroFunctionExecOptions<ISchema>>;
  public execOptions: IHeroFunctionExecOptions<ISchema>;
  public components: IHeroFunctionComponents<ISchema>;

  private pendingOutputs: IOutputChangeToRecord[] = [];
  private pendingUploadPromises = new Set<Promise<void>>();
  private coreSessionPromise: Promise<ICoreSession>;

  constructor(components: IHeroFunctionComponents<ISchema>) {
    this.components = components;
    this.uploadOutputs = this.uploadOutputs.bind(this);
  }

  public async run(
    functionInternal: FunctionInternal<ISchema, IHeroFunctionExecOptions<ISchema>>,
    context: IHeroFunctionContext<ISchema>,
    next: () => Promise<IHeroFunctionContext<ISchema>['outputs']>,
  ): Promise<void> {
    this.execOptions = functionInternal.options;
    this.functionInternal = functionInternal;
    this.functionInternal.onOutputChanges = this.onOutputChanged.bind(this);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const container = this;
    try {
      const HeroReplayBase = HeroReplay;
      const {
        input,
        affiliateId,
        payment,
        authentication,
        isFromCommandLine,
        ...heroApplicableOptions
      } = functionInternal.options as IFunctionExecOptions<ISchema>;

      const heroOptions: IHeroCreateOptions = {
        ...heroApplicableOptions,
        input: this.functionInternal.input,
      };

      const HeroBase = Hero;
      // eslint-disable-next-line @typescript-eslint/no-shadow
      context.Hero = class Hero extends HeroBase {
        constructor(options: IHeroCreateOptions = {}) {
          if (container.hero) {
            throw new Error('Multiple Hero instances are not supported in a Datastore Function.');
          }
          super({ ...heroOptions, ...options });
          container.hero = this;
          this.toCrawlerOutput = async (): Promise<ICrawlerOutputSchema> => {
            return {
              sessionId: await this.sessionId,
              crawler: 'Hero',
              version: this.version,
            };
          };
          void this.once('connected', container.onConnected.bind(container, this));
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-shadow
      context.HeroReplay = class HeroReplay extends HeroReplayBase {
        constructor(options: IHeroReplayCreateOptions | ICrawlerOutputSchema = {}) {
          // extract sessionId so that we don't try to reload
          const { sessionId, crawler, version, ...replayOptions } = options as any;

          const replaySessionId =
            sessionId || heroOptions.replaySessionId || process.env.ULX_REPLAY_SESSION_ID;

          super({
            ...heroOptions,
            ...replayOptions,
            replaySessionId,
          });
          container.heroReplays.add(this);
          this.once('connected', container.onConnected.bind(container, this));
        }

        static async fromCrawler<T extends Crawler>(
          crawler: T,
          options: T['runArgsType'] = {},
        ): Promise<HeroReplay> {
          if (heroOptions.replaySessionId) return new context.HeroReplay(heroOptions);
          const crawl = await context.crawl(crawler, options);
          return new context.HeroReplay(crawl);
        }
      };

      await next();

      // need to allow an immediate for directly emitted outputs to register
      await new Promise(setImmediate);
      await Promise.all(this.pendingUploadPromises);
    } finally {
      const heroes = [this.hero, ...this.heroReplays].filter(Boolean);
      await Promise.all(heroes.map(x => x.close().catch(() => null)));
    }
  }

  // INTERNALS ///////////////////////

  protected onConnected(source: Hero | HeroReplay): void {
    const coreSessionPromise = source[InternalPropertiesSymbol].coreSessionPromise;
    this.coreSessionPromise = coreSessionPromise;
    // drown unhandled errors
    void coreSessionPromise
      .then(() => this.registerSessionClose(coreSessionPromise))
      .catch(() => null);
    this.uploadOutputs();
  }

  protected async registerSessionClose(coreSessionPromise: Promise<ICoreSession>): Promise<void> {
    try {
      const coreSession = await coreSessionPromise;
      if (!coreSession) return;
      coreSession.once('close', () => {
        if (this.coreSessionPromise === coreSessionPromise) this.coreSessionPromise = null;
      });
    } catch (err) {
      console.error(err);
      if (this.coreSessionPromise === coreSessionPromise) this.coreSessionPromise = null;
    }
  }

  protected uploadOutputs(): void {
    if (!this.pendingOutputs.length || !this.coreSessionPromise) return;

    const records = [...this.pendingOutputs];
    this.pendingOutputs.length = 0;
    const promise = this.coreSessionPromise.then(x => x.recordOutput(records)).catch(() => null);

    this.pendingUploadPromises.add(promise);
    void promise.then(() => this.pendingUploadPromises.delete(promise));
  }

  private onOutputChanged(changes: IObservableChange[]): void {
    const changesToRecord: IOutputChangeToRecord[] = changes.map(change => ({
      type: change.type as string,
      value: change.value,
      path: JSON.stringify(change.path),
      timestamp: Date.now(),
    }));

    this.pendingOutputs.push(...changesToRecord);

    this.uploadOutputs();
  }
}
