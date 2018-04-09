import Reflux from 'reflux';

let GuideActions = Reflux.createActions([
  'closeGuideOrSupport',
  'fetchSucceeded',
  'nextStep',
  'registerAnchor',
  'unregisterAnchor',
]);

export default GuideActions;
