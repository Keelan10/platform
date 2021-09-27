import IDataboxUpdatedEvent from './IDataboxUpdatedEvent';
import IHeroSessionActiveEvent from './IHeroSessionActiveEvent';

export default interface IChromeAliveEvents {
  'App.show': null;
  'App.hide': null;
  'App.quit': null;
  'App.onTop': boolean;
  'Session.loading': void;
  'Session.loaded': void;
  'Session.active': IHeroSessionActiveEvent;
  'Databox.updated': IDataboxUpdatedEvent;
}
