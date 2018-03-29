import {Client} from '../api';
import GuideActions from '../actions/guideActions';
import HookStore from '../stores/hookStore';

const api = new Client();

export function fetchGuides() {
  api.request('/assistant/', {
    method: 'GET',
    success: data => {
      GuideActions.fetchSucceeded(data);
    },
  });
}

export function registerAnchor(anchor) {
  GuideActions.registerAnchor(anchor);
}

export function unregisterAnchor(anchor) {
  GuideActions.unregisterAnchor(anchor);
}

export function nextStep() {
  GuideActions.nextStep();
}

export function closeGuideOrSupport() {
  GuideActions.closeGuideOrSupport();
}

export function openDrawer() {
  GuideActions.openDrawer();
}

export function recordFinish(guideId, useful) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'viewed',
      useful,
    },
  });
  HookStore.get('analytics:event').forEach(cb =>
    cb('assistant.guide_finished', {
      guide: guideId,
      useful,
    })
  );
}

export function recordDismiss(guideId, step) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'dismissed',
    },
  });
  HookStore.get('analytics:event').forEach(cb =>
    cb('assistant.guide_dismissed', {
      guide: guideId,
      step,
    })
  );
}
