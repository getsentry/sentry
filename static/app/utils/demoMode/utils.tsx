import {setForceHide} from 'sentry/actionCreators/guides';
import type {Client} from 'sentry/api';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUTMState} from 'sentry/utils/demoMode/utm';

import {demoSignupModal} from '../../actionCreators/modal';

import {isDemoModeActive} from './index';

const SIGN_UP_MODAL_DELAY = 2 * 60 * 1000;

const DEMO_MODE_EMAIL_KEY = 'demo-mode:email';

export function openDemoSignupModal() {
  if (!isDemoModeActive()) {
    return;
  }
  setTimeout(() => {
    demoSignupModal();
  }, SIGN_UP_MODAL_DELAY);
}

export async function captureEmail(api: Client) {
  if (!isDemoModeActive()) {
    return;
  }

  const email = localStorage.getItem(DEMO_MODE_EMAIL_KEY);

  if (email === 'submitted') {
    return;
  }

  const utmState = getUTMState();

  try {
    await api.requestPromise('/internal/demo/email-capture/', {
      method: 'POST',
      data: {
        ...utmState.data,
        email,
      },
    });

    openDemoSignupModal();

    localStorage.setItem(DEMO_MODE_EMAIL_KEY, 'submitted');
    trackAnalytics('growth.demo_email_submitted', {organization: null});
  } catch (error) {
    // do nothing
  } finally {
    setForceHide(false);
  }
}
