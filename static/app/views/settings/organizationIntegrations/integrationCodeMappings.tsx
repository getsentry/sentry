import {Fragment, useCallback, useMemo} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  useMutation,
} from '@tanstack/react-query';
import sortBy from 'lodash/sortBy';

import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {Integration, RepositoryProjectPathConfig} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {organizationRepositoriesInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import {RepositoryProjectPathConfigModal} from './repositoryProjectPathConfigForm';
import {RepositoryProjectPathConfigRow} from './repositoryProjectPathConfigRow';

const COLUMNS: TableColumnConfig[] = [
  {key: 'codeMapping', width: 'minmax(200px, 4.5fr)'},
  {key: 'stackRoot', width: 'minmax(150px, 2.5fr)'},
  {key: 'sourceRoot', width: 'minmax(150px, 2.5fr)'},
  {key: 'actions', width: 'max-content'},
];

function getDocsLink(integration: Integration): string {
  /** Accounts for some asymmetry between docs links and provider keys */
  let docsKey = integration.provider.key;
  switch (integration.provider.key) {
    case 'vsts':
      docsKey = 'azure-devops';
      break;
    case 'github_enterprise':
      docsKey = 'github';
      break;
    default:
      docsKey = integration.provider.key;
      break;
  }
  return `https://docs.sentry.io/product/integrations/source-code-mgmt/${docsKey}/#stack-trace-linking`;
}

function codeMappingsApiOptions({
  orgSlug,
  integrationId,
  cursor,
}: {
  orgSlug: string;
  cursor?: string | string[] | null;
  integrationId?: string;
}) {
  return apiOptions.as<RepositoryProjectPathConfig[]>()(
    '/organizations/$organizationIdOrSlug/code-mappings/',
    {
      path: {organizationIdOrSlug: orgSlug},
      query: {integrationId, cursor},
      staleTime: 10_000,
    }
  );
}

function useDeletePathConfig({
  queryKey,
}: {
  queryKey: ReturnType<typeof codeMappingsApiOptions>['queryKey'];
}) {
  const api = useApi({persistInFlight: false});
  const organization = useOrganization();
  const queryClient = useQueryClient();
  return useMutation<
    RepositoryProjectPathConfig,
    RequestError,
    RepositoryProjectPathConfig
  >({
    mutationFn: pathConfig => {
      return api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/code-mappings/$configId/', {
          path: {organizationIdOrSlug: organization.slug, configId: pathConfig.id},
        }),
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: pathConfig => {
      if (pathConfig.integrationId) {
        queryClient.setQueryData(queryKey, prevData =>
          prevData
            ? {
                ...prevData,
                json: prevData.json.filter(config => config.id !== pathConfig.id),
              }
            : prevData
        );
      }
    },
    onSuccess: () => {
      addSuccessMessage(t('Successfully deleted code mapping'));
    },
    onError: error => {
      addErrorMessage(`${error.statusText}: ${error.responseText}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: codeMappingsApiOptions({
          orgSlug: organization.slug,
        }).queryKey,
      });
    },
  });
}

export function IntegrationCodeMappings({integration}: {integration: Integration}) {
  const {openModal} = useModal();

  const queryClient = useQueryClient();
  useRouteAnalyticsEventNames(
    'integrations.code_mappings_viewed',
    'Integrations: Code Mappings Viewed'
  );
  useRouteAnalyticsParams({
    integration: integration.provider.key,
    integration_type: 'first_party',
  });

  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation();
  const integrationId = integration.id;

  const pathConfigsQueryOptions = codeMappingsApiOptions({
    orgSlug: organization.slug,
    integrationId,
    cursor: location.query.cursor,
  });

  const {
    data: pathConfigsResponse,
    isPending: isPendingPathConfigs,
    isError: isErrorPathConfigs,
    refetch: refetchPathConfigs,
  } = useQuery({
    ...pathConfigsQueryOptions,
    select: selectJsonWithHeaders,
  });

  const repositoriesQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({
      organization,
      query: {status: 'active', per_page: 100},
      staleTime: 10_000,
    }),
    select: data => data.pages.flatMap(page => page.json),
  });
  useFetchAllPages({result: repositoriesQuery});

  const {
    data: fetchedRepos = [],
    isPending: isPendingReposQuery,
    isError: isErrorRepos,
    hasNextPage: hasNextReposPage,
    isFetchingNextPage: isFetchingNextReposPage,
    refetch: refetchRepos,
  } = repositoriesQuery;

  const isPendingRepos =
    isPendingReposQuery ||
    isFetchingNextReposPage ||
    (!!hasNextReposPage && !isErrorRepos);

  const pathConfigs = useMemo(() => {
    return sortBy(pathConfigsResponse?.json ?? [], [
      ({projectSlug}) => projectSlug,
      ({id}) => parseInt(id, 10),
    ]);
  }, [pathConfigsResponse?.json]);

  const repos = useMemo(
    () => fetchedRepos.filter(repo => repo.integrationId === integrationId),
    [fetchedRepos, integrationId]
  );

  const getMatchingProject = useCallback(
    (pathConfig: RepositoryProjectPathConfig) => {
      return projects.find(project => project.id === pathConfig.projectId);
    },
    [projects]
  );

  const {mutate: deletePathConfig} = useDeletePathConfig({
    queryKey: pathConfigsQueryOptions.queryKey,
  });

  const openCodeMappingModal = (pathConfig?: RepositoryProjectPathConfig) => {
    trackAnalytics('integrations.stacktrace_start_setup', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: integration.provider.key,
      organization,
    });

    openModal(
      modalProps => (
        <RepositoryProjectPathConfigModal
          {...modalProps}
          organization={organization}
          integration={integration}
          projects={projects}
          repos={repos}
          existingConfig={pathConfig}
        />
      ),
      {
        onClose: () => {
          queryClient.invalidateQueries({
            queryKey: codeMappingsApiOptions({
              orgSlug: organization.slug,
            }).queryKey,
          });
        },
      }
    );
  };

  const isLoading = isPendingPathConfigs || isPendingRepos;
  const pathConfigsPageLinks = pathConfigsResponse?.headers.Link;
  const docsLink = getDocsLink(integration);

  return (
    <Fragment>
      <TextBlock>
        {tct(
          'Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].',
          {
            link: (
              <ExternalLink
                href={docsLink}
                onClick={() => {
                  trackAnalytics('integrations.stacktrace_docs_clicked', {
                    view: 'integration_configuration_detail',
                    provider: integration.provider.key,
                    organization,
                  });
                }}
              />
            ),
          }
        )}
      </TextBlock>

      <SimpleTable
        aria-label={t('Code Mappings')}
        columns={COLUMNS}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Code Mappings')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Stack Trace Root')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Source Code Root')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">
              <Button
                data-test-id="add-mapping-button"
                onClick={() => openCodeMappingModal()}
                size="xs"
                icon={<IconAdd />}
                disabled={isLoading || isErrorPathConfigs || isErrorRepos}
              >
                {t('Add Code Mapping')}
              </Button>
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isLoading ? (
          <SimpleTable.Loading />
        ) : isErrorPathConfigs ? (
          <SimpleTable.Error
            message={t('Error loading code mappings')}
            onRetry={refetchPathConfigs}
          />
        ) : isErrorRepos ? (
          <SimpleTable.Error
            message={t('Error loading repositories')}
            onRetry={refetchRepos}
          />
        ) : pathConfigs.length === 0 ? (
          <SimpleTable.Empty>
            <EmptyMessage
              icon={getIntegrationIcon(integration.provider.key, 'lg')}
              action={
                <LinkButton
                  href={docsLink}
                  size="sm"
                  external
                  onClick={() => {
                    trackAnalytics('integrations.stacktrace_docs_clicked', {
                      view: 'integration_configuration_detail',
                      provider: integration.provider.key,
                      organization,
                    });
                  }}
                >
                  {t('View Documentation')}
                </LinkButton>
              }
            >
              {t('Set up stack trace linking by adding a code mapping.')}
            </EmptyMessage>
          </SimpleTable.Empty>
        ) : (
          pathConfigs
            .map(pathConfig => {
              const project = getMatchingProject(pathConfig);
              // this should never happen since our pathConfig would be deleted
              // if project was deleted
              if (!project) {
                return null;
              }
              return (
                <RepositoryProjectPathConfigRow
                  key={pathConfig.id}
                  pathConfig={pathConfig}
                  project={project}
                  onEdit={openCodeMappingModal}
                  onDelete={() => deletePathConfig(pathConfig)}
                />
              );
            })
            .filter(item => !!item)
        )}
      </SimpleTable>
      {pathConfigsPageLinks && <Pagination pageLinks={pathConfigsPageLinks} />}
    </Fragment>
  );
}
