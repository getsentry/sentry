import Reflux from 'reflux';

const GuideActions = Reflux.createActions([
  'closeGuide',
  'fetchSucceeded',
  'nextStep',
  'toStep',
  'registerAnchor',
  'unregisterAnchor',
]);

export default GuideActions;
