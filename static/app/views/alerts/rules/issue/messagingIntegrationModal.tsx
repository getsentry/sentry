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
  headerContent: React.ReactElement<any, any>;
  organization: Organization;
  project: Project;
  providerKeys: string[];
  bodyContent?: React.ReactElement<any, any>;
};

function MessagingIntegrationModal({
  closeModal,
  Header,
  Body,
  headerContent,
  bodyContent,
  providerKeys,
  organization,
  project,
}: Props) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (hasError) {
      closeModal();
      addErrorMessage(t('Failed to load integration data'));
    }
  }, [hasError, closeModal]);

  return (
    <Fragment>
      <Header closeButton>{headerContent}</Header>
      <Body>
        {bodyContent}
        <IntegrationsWrapper>
          {providerKeys.map((value: string) => {
            return (
              <AddIntegrationRow
                key={value}
                providerKey={value}
                organization={organization}
                project={project}
                onClickHandler={closeModal}
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
