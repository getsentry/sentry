import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  OrganizationIntegration,
  ServerlessFunction,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {IntegrationServerlessRow} from 'sentry/views/settings/organizationIntegrations/integrationServerlessRow';

export function IntegrationServerlessFunctions({
  integration,
}: {
  integration: OrganizationIntegration;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/integrations/${integration.id}/serverless-functions/`,
  ];
  const {data: serverlessFunctions = [], isSuccess} = useApiQuery<ServerlessFunction[]>(
    queryKey,
    {staleTime: 0}
  );

  useEffect(() => {
    if (isSuccess) {
      trackAnalytics('integrations.serverless_functions_viewed', {
        integration: integration.provider.key,
        integration_type: 'first_party',
        num_functions: serverlessFunctions.length,
        organization,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return (
    <Fragment>
      <Alert.Container>
        <Alert type="info">
          {t(
            'Manage your AWS Lambda functions below. Only Node and Python runtimes are currently supported.'
          )}
        </Alert>
      </Alert.Container>
      <Panel>
        <StyledPanelHeader disablePadding hasButtons>
          <NameHeader>{t('Name')}</NameHeader>
          <LayerStatusWrapper>{t('Layer Status')}</LayerStatusWrapper>
          <EnableHeader>{t('Enabled')}</EnableHeader>
        </StyledPanelHeader>
        <StyledPanelBody>
          {serverlessFunctions.map((serverlessFn, i) => (
            <IntegrationServerlessRow
              key={serverlessFn.name}
              serverlessFunction={serverlessFn}
              integration={integration}
              onUpdate={(update: Partial<ServerlessFunction>) => {
                setApiQueryData<ServerlessFunction[]>(
                  queryClient,
                  queryKey,
                  existingServerlessFunctions => {
                    if (!existingServerlessFunctions) {
                      return undefined;
                    }
                    const newServerlessFunctions = [...existingServerlessFunctions];
                    const updatedFunction = {
                      ...newServerlessFunctions[i]!,
                      ...update,
                    };
                    newServerlessFunctions[i] = updatedFunction;
                    return newServerlessFunctions;
                  }
                );
              }}
            />
          ))}
        </StyledPanelBody>
      </Panel>
    </Fragment>
  );
}

const StyledPanelHeader = styled(PanelHeader)`
  padding: ${space(2)};
  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2fr 1fr 0.5fr;
  grid-template-areas: 'function-name layer-status enable-switch';
`;

const HeaderText = styled('div')`
  flex: 1;
`;

const StyledPanelBody = styled(PanelBody)``;

const NameHeader = styled(HeaderText)`
  grid-area: function-name;
`;

const LayerStatusWrapper = styled(HeaderText)`
  grid-area: layer-status;
`;

const EnableHeader = styled(HeaderText)`
  grid-area: enable-switch;
`;
