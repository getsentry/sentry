import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';

type Props = ModalRenderProps & {
  organization: Organization;
  project: Project;
};

function MessagingIntegrationModal({
  closeModal,
  Header,
  Body,
  organization,
  project,
}: Props) {
  const [hasError, setHasError] = useState(false);
  const integrationValues = ['slack', 'discord', 'msteams'];

  useEffect(() => {
    if (hasError) {
      closeModal();
      addErrorMessage(t('Failed to load integration data'));
    }
  }, [hasError, closeModal]);

  return (
    <Fragment>
      <Header closeButton>
        <h1>Connect with a messaging tool</h1>
      </Header>
      <Body>
        <p>Receive alerts and digests right where you work.</p>
        <IntegrationsWrapper>
          {integrationValues.map((value: string) => {
            return (
              <AddIntegrationRow
                key={value}
                providerKey={value}
                organization={organization}
                project={project}
                closeModal={closeModal}
                setHasError={setHasError}
              />
            );
          })}
        </IntegrationsWrapper>
      </Body>
    </Fragment>
  );
}

const IntegrationsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

export default MessagingIntegrationModal;
