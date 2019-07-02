import {Client} from 'app/api';
import GuideActions from 'app/actions/guideActions';
import {trackAnalyticsEvent} from 'app/utils/analytics';

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

export function closeGuide() {
  GuideActions.closeGuide();
}

export function dismissGuide(guideId, step, org) {
  recordDismiss(guideId, step, org);
  closeGuide();
}

export function recordFinish(guideId, org) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'viewed',
    },
  });
  const data = {
    eventKey: 'assistant.guide_finished',
    eventName: 'Assistant Guide Finished',
    guide: guideId,
  };
  if (org) {
    data.organization_id = org.id;
  }
  trackAnalyticsEvent(data);
}

export function recordDismiss(guideId, step, org) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'dismissed',
    },
  });
  const data = {
    eventKey: 'assistant.guide_dismissed',
    eventName: 'Assistant Guide Dismissed',
    guide: guideId,
    step,
  };
  if (org) {
    data.organization_id = org.id;
  }
  trackAnalyticsEvent(data);
}
