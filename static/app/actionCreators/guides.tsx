import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {
  getDemoGuides,
  getTourTask,
  updateDemoWalkthroughTask,
} from 'sentry/utils/demoMode/guides';

import {demoEndModal} from './modal';

const api = new Client();

export async function fetchGuides() {
  try {
    if (isDemoModeActive()) {
      GuideStore.fetchSucceeded(getDemoGuides());
      return;
    }
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

export function closeGuide(dismissed?: boolean) {
  GuideStore.closeGuide(dismissed);
}

export function dismissGuide(guide: string, step: number, orgId: string | null) {
  recordDismiss(guide, step, orgId);
  closeGuide(true);
}

export function recordFinish(guide: string, orgId: string | null) {
  if (!isDemoModeActive()) {
    api.requestPromise('/assistant/', {
      method: 'PUT',
      data: {
        guide,
        status: 'viewed',
      },
    });
  }

  const tourTask = getTourTask(guide);

  if (isDemoModeActive() && tourTask) {
    const {tour, task} = tourTask;
    updateDemoWalkthroughTask({task, status: 'complete', completionSeen: true});
    demoEndModal({tour});
  }

  const user = ConfigStore.get('user');
  if (!user) {
    return;
  }

  trackAnalytics('assistant.guide_finished', {
    organization: orgId,
    guide,
  });
}

function recordDismiss(guide: string, step: number, orgId: string | null) {
  if (!isDemoModeActive()) {
    api.requestPromise('/assistant/', {
      method: 'PUT',
      data: {
        guide,
        status: 'dismissed',
      },
    });
  }

  const user = ConfigStore.get('user');
  if (!user) {
    return;
  }
  trackAnalytics('assistant.guide_dismissed', {
    organization: orgId,
    guide,
    step,
  });
}
