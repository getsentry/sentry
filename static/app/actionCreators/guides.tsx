import GuideActions from 'sentry/actions/guideActions';
import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {run} from 'sentry/utils/apiSentryClient';

const api = new Client();

export async function fetchGuides() {
  try {
    const data = await api.requestPromise('/assistant/');
    GuideActions.fetchSucceeded(data);
  } catch (error) {
    run(Sentry => Sentry.captureException(error));
  }
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

export function setForceHide(forceHide: boolean) {
  GuideActions.setForceHide(forceHide);
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
