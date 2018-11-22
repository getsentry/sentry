import Reflux from 'reflux';

let GuideActions = Reflux.createActions([
  'closeGuide',
  'fetchSucceeded',
  'nextStep',
  'registerAnchor',
  'unregisterAnchor',
]);

export default GuideActions;
