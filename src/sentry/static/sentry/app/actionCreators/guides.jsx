import {Client} from 'app/api';
import GuideActions from 'app/actions/guideActions';
import analytics from 'app/utils/analytics';

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

export function recordFinish(guideId, useful) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'viewed',
      useful,
    },
  });
  analytics('assistant.guide_finished', {
    guide: guideId,
    useful,
  });
}

export function recordDismiss(guideId, step) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'dismissed',
    },
  });
  analytics('assistant.guide_dismissed', {
    guide: guideId,
    step,
  });
}
