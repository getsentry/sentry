import {Fragment, useEffect} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {
  OrganizationIntegration,
  ServerlessFunction,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {IntegrationServerlessRow} from './integrationServerlessRow';

const COLUMNS: TableColumnConfig[] = [
  {key: 'name', width: 'minmax(200px, 2fr)'},
  {key: 'layerStatus', width: 'minmax(max-content, 1fr)'},
  {key: 'enabled', width: 'minmax(max-content, 0.5fr)'},
];

export function IntegrationServerlessFunctions({
  integration,
}: {
  integration: OrganizationIntegration;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const queryOptions = apiOptions.as<ServerlessFunction[]>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/serverless-functions/',
    {
      path: {organizationIdOrSlug: organization.slug, integrationId: integration.id},
      staleTime: 0,
    }
  );
  const {
    data: serverlessFunctions = [],
    isError,
    isPending,
    isSuccess,
    refetch,
  } = useQuery(queryOptions);

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
            'Manage your AWS Lambda Event Functions below. Only Node and Python runtimes are currently supported.'
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
                queryClient.setQueryData(queryOptions.queryKey, previous => {
                  const existingServerlessFunctions = previous?.json;

                  if (!existingServerlessFunctions) {
                    return previous;
                  }
                  const newServerlessFunctions = [...existingServerlessFunctions];
                  const updatedFunction = {
                    ...newServerlessFunctions[i]!,
                    ...update,
                  };
                  newServerlessFunctions[i] = updatedFunction;
                  return {
                    ...previous,
                    headers: previous?.headers ?? {},
                    json: newServerlessFunctions,
                  };
                });
              }}
            />
          ))
        )}
      </SimpleTable>
    </Fragment>
  );
}
