import * as Sentry from '@sentry/react';

import {setForceHide} from 'sentry/actionCreators/guides';
import {demoSignupModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUTMState} from 'sentry/utils/demoMode/utm';

import {isDemoModeActive} from './index';

const SIGN_UP_MODAL_DELAY = 2 * 60 * 1000;

const DEMO_MODE_EMAIL_KEY = 'demo-mode:email';

function openDemoSignupModal() {
  if (!isDemoModeActive()) {
    return;
  }
  setTimeout(() => {
    demoSignupModal();
  }, SIGN_UP_MODAL_DELAY);
}

export function initDemoMode(api: Client) {
  if (!isDemoModeActive()) {
    return;
  }
  initDemoAnalytics();
  captureEmail(api);
}

async function captureEmail(api: Client) {
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

function initDemoAnalytics() {
  if (!isDemoModeActive()) {
    return;
  }

  if (document.getElementById('plausible-script')) {
    return;
  }

  try {
    const mainScript = document.createElement('script');
    mainScript.id = 'plausible-script';
    mainScript.defer = true;
    mainScript.setAttribute('data-domain', window.location.hostname);
    mainScript.src = 'https://plausible.io/js/script.pageview-props.tagged-events.js';

    const queueScript = document.createElement('script');
    queueScript.id = 'plausible-queue-script';
    queueScript.textContent =
      'window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }';

    document.head.appendChild(mainScript);
    document.head.appendChild(queueScript);
  } catch (error) {
    Sentry.captureException(error);
  }
}
