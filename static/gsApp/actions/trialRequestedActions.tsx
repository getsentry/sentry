import {TrialRequestedStore} from 'getsentry/stores/trialRequestedStore';

export const TrialRequestedActions = {
  requested: () => TrialRequestedStore.onRequested(),
  clearNotification: () => TrialRequestedStore.onClearNotification(),
};
