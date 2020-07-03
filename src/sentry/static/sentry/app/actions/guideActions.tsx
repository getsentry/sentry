import Reflux from 'reflux';

const GuideActions = Reflux.createActions([
  'closeGuide',
  'fetchSucceeded',
  'nextStep',
  'registerAnchor',
  'unregisterAnchor',
]);

export default GuideActions;
