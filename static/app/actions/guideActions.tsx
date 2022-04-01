import {createActions} from 'reflux';

const GuideActions = createActions([
  'closeGuide',
  'fetchSucceeded',
  'nextStep',
  'toStep',
  'registerAnchor',
  'unregisterAnchor',
  'setForceHide',
]);

export default GuideActions;
