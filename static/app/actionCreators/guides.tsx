import GuideActions from 'app/actions/guideActions';
import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';

const api = new Client();

export function fetchGuides() {
  api.request('/assistant/?v2', {
    method: 'GET',
    success: data => {
      GuideActions.fetchSucceeded(data);
    },
  });
}

export function registerAnchor(target: string) {
  GuideActions.registerAnchor(target);
}

export function unregisterAnchor(target: string) {
  GuideActions.unregisterAnchor(target);
}

export function nextStep() {
  GuideActions.nextStep();
}

export function toStep(step: number) {
  GuideActions.toStep(step);
}

export function closeGuide(dismissed?: boolean) {
  GuideActions.closeGuide(dismissed);
}

export function dismissGuide(guide: string, step: number, orgId: string | null) {
  recordDismiss(guide, step, orgId);
  closeGuide(true);
}

export function recordFinish(guide: string, orgId: string | null) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide,
      status: 'viewed',
    },
  });

  const user = ConfigStore.get('user');
  if (!user) {
    return;
  }

  const data = {
    eventKey: 'assistant.guide_finished',
    eventName: 'Assistant Guide Finished',
    guide,
    organization_id: orgId,
    user_id: parseInt(user.id, 10),
  };
  trackAnalyticsEvent(data);
}

export function recordDismiss(guide: string, step: number, orgId: string | null) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide,
      status: 'dismissed',
    },
  });

  const user = ConfigStore.get('user');
  if (!user) {
    return;
  }

  const data = {
    eventKey: 'assistant.guide_dismissed',
    eventName: 'Assistant Guide Dismissed',
    guide,
    step,
    organization_id: orgId,
    user_id: parseInt(user.id, 10),
  };
  trackAnalyticsEvent(data);
}
