import 'core-js/stable';
import 'regenerator-runtime/runtime';

import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {IconArrow} from 'sentry/icons';

import getSentryApp from '../getSentryApp';

const addedEmail = 'sandbox_email_added';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.SandboxData.skipEmail) {
    window.localStorage.setItem(addedEmail, '1');
  }
  if (window.localStorage.getItem(addedEmail) !== '1') {
    // const SentryApp = await getSentryApp();
    // SentryApp.GuideActionCreator.setForceHide(true);
    const Modal = (await import('./modal')).default;
    openModal(
      modalProps => (
        <Modal
          onAddedEmail={onAddedEmail}
          onFailure={handleFailure}
          IconArrow={IconArrow}
          {...modalProps}
        />
      ),
      {closeEvents: 'none', modalCss}
    );
  }
});

function onAddedEmail(email) {
  getSentryApp().then(SentryApp => SentryApp.GuideActionCreator.setForceHide(false));
  window.localStorage.setItem('email', email);
  window.localStorage.setItem(
    'time_entered',
    JSON.stringify(Math.floor(new Date().getTime() / 1000))
  );
  window.localStorage.setItem(addedEmail, '1');
}

function handleFailure() {
  getSentryApp().then(SentryApp => SentryApp.GuideActionCreator.setForceHide(false));
}

const modalCss = css`
  width: 100%;
  max-width: 1000px;
  [role='document'] {
    position: relative;
    padding: 50px 60px;
    overflow: hidden;
  }
`;
