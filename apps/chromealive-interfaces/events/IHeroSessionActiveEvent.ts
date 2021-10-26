import ITimelineMetadata from '@ulixee/hero-interfaces/ITimelineMetadata';

export default interface IHeroSessionActiveEvent {
  scriptEntrypoint: string;
  scriptLastModifiedTime: number;
  heroSessionId: string;
  hasWarning: boolean;
  playbackState: 'live' | 'paused' | 'timetravel';
  run: number;
  runtimeMs: number;
  needsPageStateResolution: boolean;
  pageStates: {
    id: string;
    offsetPercent: number;
    isUnresolved: boolean;
  }[];
  timeline: ITimelineMetadata;
}
