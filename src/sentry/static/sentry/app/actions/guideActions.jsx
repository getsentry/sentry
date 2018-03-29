import Reflux from 'reflux';

let GuideActions = Reflux.createActions([
  'closeGuideOrSupport',
  'fetchSucceeded',
  'nextStep',
  'openDrawer',
  'registerAnchor',
  'unregisterAnchor',
]);

export default GuideActions;
