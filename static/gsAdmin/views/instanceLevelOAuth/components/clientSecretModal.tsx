import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LinkButton} from 'sentry/components/core/button/linkButton';

interface ClientDetails {
  clientID: string;
  clientSecret: string;
}

function ClientSecretModal({
  Body,
  Header,
  clientSecret,
  clientID,
}: ModalRenderProps & ClientDetails) {
  return (
    <Fragment>
      <Header closeButton>Client Secret Details (ONE-TIME ONLY)</Header>
      <Body>
        <p>
          Your client secret is <b>{clientSecret}</b>
        </p>
        <p>Make sure you save this now! You will not be able to see it again later.</p>
        <LinkButton priority="danger" to={`/_admin/instance-level-oauth/${clientID}/`}>
          I understand, take me to the rest of my client details.
        </LinkButton>
      </Body>
    </Fragment>
  );
}

export default ClientSecretModal;
