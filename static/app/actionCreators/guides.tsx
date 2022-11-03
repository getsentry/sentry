import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getTour, isDemoWalkthrough} from 'sentry/utils/demoMode';

import {demoEndModal} from './modal';

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

export function recordFinish(
  guide: string,
  orgId: string | null,
  orgSlug: string | null
) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide,
      status: 'viewed',
    },
  });

  if (isDemoWalkthrough()) {
    const tour = getTour(guide);
    demoEndModal({tour, orgSlug});
  }

  const user = ConfigStore.get('user');
  if (!user) {
    return;
  }

  trackAdvancedAnalyticsEvent('assistant.guide_finished', {
    organization: orgId,
    guide,
  });
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
  trackAdvancedAnalyticsEvent('assistant.guide_dismissed', {
    organization: orgId,
    guide,
    step,
  });
}
