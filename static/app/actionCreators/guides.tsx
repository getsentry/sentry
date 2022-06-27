import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';

const api = new Client();

export async function fetchGuides() {
  try {
    const data = await api.requestPromise('/assistant/');
    GuideStore.fetchSucceeded(data);
  } catch (err) {
    if (err.status !== 401 && err.status !== 403) {
      Sentry.captureException(err);
    }
  }
}

export function registerAnchor(target: string) {
  GuideStore.registerAnchor(target);
}

export function unregisterAnchor(target: string) {
  GuideStore.unregisterAnchor(target);
}

export function nextStep() {
  GuideStore.nextStep();
}

export function setForceHide(forceHide: boolean) {
  GuideStore.setForceHide(forceHide);
}

export function toStep(step: number) {
  GuideStore.toStep(step);
}

export function closeGuide(dismissed?: boolean) {
  GuideStore.closeGuide(dismissed);
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
