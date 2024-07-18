import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

function SetupAlertIntegrationModal({Header, Body}: ModalRenderProps) {
  return (
    <Fragment>
      <Header closeButton>Connect with a messaging tool</Header>
      <Body>
        <div>Receive alerts and digests right where you work.</div>
      </Body>
    </Fragment>
  );
}

export default SetupAlertIntegrationModal;
