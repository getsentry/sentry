import {setForceHide} from 'sentry/actionCreators/guides';
import ConfigStore from 'sentry/stores/configStore';

import {demoEmailModal, demoSignupModal} from '../../actionCreators/modal';

const SIGN_UP_MODAL_DELAY = 30_000;

const DEMO_MODE_EMAIL_KEY = 'demo-mode:email';

export function extraQueryParameter(): URLSearchParams {
  const extraQueryString = window.SandboxData?.extraQueryString || '';
  const extraQuery = new URLSearchParams(extraQueryString);
  return extraQuery;
}

export function extraQueryParameterWithEmail(): URLSearchParams {
  const params = extraQueryParameter();
  const email = localStorage.getItem('email');
  if (email) {
    params.append('email', email);
  }
  return params;
}

export function urlAttachQueryParams(url: string, params: URLSearchParams): string {
  const queryString = params.toString();
  if (queryString) {
    return url + '?' + queryString;
  }
  return url;
}

export function isDemoModeEnabled(): boolean {
  return ConfigStore.get('demoMode');
}

export function openDemoSignupModal() {
  if (!isDemoModeEnabled()) {
    return;
  }
  setTimeout(() => {
    demoSignupModal();
  }, SIGN_UP_MODAL_DELAY);
}

export function openDemoEmailModal() {
  if (!isDemoModeEnabled()) {
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
