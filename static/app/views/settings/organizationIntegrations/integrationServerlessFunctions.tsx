import {Fragment, useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {
  OrganizationIntegration,
  ServerlessFunction,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationServerlessRow} from 'sentry/views/settings/organizationIntegrations/integrationServerlessRow';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'layerStatus', width: 'minmax(140px, 1fr)'},
  {key: 'enabled', width: 'minmax(80px, 0.5fr)'},
];

export function IntegrationServerlessFunctions({
  integration,
}: {
  integration: OrganizationIntegration;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryKey: ApiQueryKey = [
    getApiUrl(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/serverless-functions/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId: integration.id},
      }
    ),
  ];
  const {
    data: serverlessFunctions = [],
    isError,
    isPending,
    isSuccess,
    refetch,
  } = useApiQuery<ServerlessFunction[]>(queryKey, {staleTime: 0});

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
        <Alert variant="info" showIcon={false}>
          {t(
            'Manage your AWS Lambda functions below. Only Node and Python runtimes are currently supported.'
          )}
        </Alert>
      </Alert.Container>
      <SimpleTable
        aria-label={t('Serverless Functions')}
        columns={COLUMNS}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Layer Status')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Enabled')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending ? (
          <SimpleTable.Loading />
        ) : isError ? (
          <SimpleTable.Error
            message={t('Error loading serverless functions')}
            onRetry={refetch}
          />
        ) : serverlessFunctions.length === 0 ? (
          <SimpleTable.Empty>{t('No serverless functions found')}</SimpleTable.Empty>
        ) : (
          serverlessFunctions.map((serverlessFn, i) => (
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
                      return;
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
          ))
        )}
      </SimpleTable>
    </Fragment>
  );
}
