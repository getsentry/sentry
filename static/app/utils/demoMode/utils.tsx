import {logout} from 'sentry/actionCreators/account';
import {setForceHide} from 'sentry/actionCreators/guides';
import {Client} from 'sentry/api';

import {demoEmailModal, demoSignupModal} from '../../actionCreators/modal';

import {isDemoModeActive} from './index';

const SIGN_UP_MODAL_DELAY = 2 * 60 * 1000;

const DEMO_MODE_EMAIL_KEY = 'demo-mode:email';

const INACTIVITY_TIMEOUT_MS = 10 * 1000;

export function openDemoSignupModal() {
  if (!isDemoModeActive()) {
    return;
  }
  setTimeout(() => {
    demoSignupModal();
  }, SIGN_UP_MODAL_DELAY);
}

export function openDemoEmailModal() {
  if (!isDemoModeActive()) {
    return;
  }

  // email already added
  if (localStorage.getItem(DEMO_MODE_EMAIL_KEY)) {
    return;
  }

  const urlEmail = new URLSearchParams(window.location.search).get('email');
  if (urlEmail) {
    onAddedEmail(urlEmail);
    const url = new URL(window.location.href);
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url.toString());
  }

  demoEmailModal({
    onAddedEmail,
    onFailure: () => {
      setForceHide(false);
    },
  });
}

function onAddedEmail(email: string) {
  setForceHide(false);
  localStorage.setItem(DEMO_MODE_EMAIL_KEY, email);
  openDemoSignupModal();
}

let inactivityTimeout: number | undefined;

window.addEventListener('blur', () => {
  if (isDemoModeActive()) {
    inactivityTimeout = window.setTimeout(() => {
      logout(new Client());
    }, INACTIVITY_TIMEOUT_MS);
  }
});

window.addEventListener('focus', () => {
  if (inactivityTimeout) {
    window.clearTimeout(inactivityTimeout);
    inactivityTimeout = undefined;
  }
});
