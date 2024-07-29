import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import AddIntegrationRow from 'sentry/views/alerts/rules/issue/addIntegrationRow';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

type Props = ModalRenderProps & {
  headerContent: React.ReactElement<any, any>;
  organization: Organization;
  project: Project;
  providerKeys: string[];
  bodyContent?: React.ReactElement<any, any>;
};

function getProvider(
  providerKey: string,
  provider: IntegrationProvider | null,
  setProvider: (IntegrationProvider) => void,
  organization: Organization,
  api: any,
  setHasError: (boolean) => void
) {
  const fetchData = useCallback(() => {
    if (!providerKey) {
      return Promise.resolve();
    }

    const endpoint = `/organizations/${organization.slug}/config/integrations/?provider_key=${providerKey}`;
    return api
      .requestPromise(endpoint)
      .then(integrations => {
        setProvider(integrations.providers[0]);
      })
      .catch(() => {
        setHasError(true);
        return null;
      });
  }, [providerKey, api, organization.slug, setHasError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return provider;
}

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
  const api = useApi();
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);
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
            getProvider(value, provider, setProvider, organization, api, setHasError);
            if (!provider) {
              return null;
            }
            return (
              <Access
                access={['org:integrations']}
                organization={organization}
                key={value}
              >
                {({hasAccess}) => {
                  return (
                    <IntegrationContext.Provider
                      value={{
                        provider: provider,
                        type: 'first_party',
                        organization: organization,
                        userHasAccess: hasAccess,
                        installStatus: 'Not Installed',
                        analyticsParams: {
                          already_installed: false,
                          view: 'onboarding',
                        },
                        modalParams: {projectId: project.id},
                      }}
                    >
                      <AddIntegrationRow onClickHandler={closeModal} />
                    </IntegrationContext.Provider>
                  );
                }}
              </Access>
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
