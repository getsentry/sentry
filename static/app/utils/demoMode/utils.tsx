import {setForceHide} from 'sentry/actionCreators/guides';

import {demoEmailModal, demoSignupModal} from '../../actionCreators/modal';

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

export function openDemoEmailModal() {
  if (!isDemoModeActive()) {
    return;
  }

  // email already added
  if (localStorage.getItem(DEMO_MODE_EMAIL_KEY)) {
    return;
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
