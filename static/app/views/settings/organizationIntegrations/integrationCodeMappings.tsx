import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  Integration,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {
  type ApiQueryKey,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import RepositoryProjectPathConfigForm from './repositoryProjectPathConfigForm';
import RepositoryProjectPathConfigRow, {
  ButtonWrapper,
  InputPathColumn,
  NameRepoColumn,
  OutputPathColumn,
} from './repositoryProjectPathConfigRow';

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

function makePathConfigQueryKey({
  orgSlug,
  integrationId,
  cursor,
}: {
  integrationId: string;
  orgSlug: string;
  cursor?: string | string[] | null;
}): ApiQueryKey {
  return [`/organizations/${orgSlug}/code-mappings/`, {query: {integrationId, cursor}}];
}

function useDeletePathConfig() {
  const api = useApi({persistInFlight: false});
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const location = useLocation();
  return useMutation<
    RepositoryProjectPathConfig,
    RequestError,
    RepositoryProjectPathConfig
  >({
    mutationFn: pathConfig => {
      return api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${pathConfig.id}/`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: pathConfig => {
      if (pathConfig.integrationId) {
        queryClient.setQueryData<RepositoryProjectPathConfig[]>(
          makePathConfigQueryKey({
            orgSlug: organization.slug,
            integrationId: pathConfig.integrationId,
            cursor: location.query.cursor,
          }),
          (data: RepositoryProjectPathConfig[] = []) => {
            return data.filter(config => config.id !== pathConfig.id);
          }
        );
      }
    },
    onSuccess: () => {
      addSuccessMessage(t('Successfully deleted code mapping'));
    },
    onError: error => {
      addErrorMessage(`${error.statusText}: ${error.responseText}`);
    },
  });
}

export default function IntegrationCodeMappings({
  integration,
}: {
  integration: Integration;
}) {
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

  const {
    data: fetchedPathConfigs = [],
    isPending: isPendingPathConfigs,
    isError: isErrorPathConfigs,
    getResponseHeader: getPathConfigsResponseHeader,
    refetch: refetchPathConfigs,
  } = useApiQuery<RepositoryProjectPathConfig[]>(
    makePathConfigQueryKey({
      orgSlug: organization.slug,
      integrationId,
      cursor: location.query.cursor,
    }),
    {
      staleTime: 30000,
    }
  );

  const {
    data: fetchedRepos = [],
    isPending: isPendingRepos,
    isError: isErrorRepos,
  } = useApiQuery<Repository[]>(
    [`/organizations/${organization.slug}/repos/`, {query: {status: 'active'}}],
    {staleTime: 30000}
  );

  const pathConfigs = useMemo(() => {
    return sortBy(fetchedPathConfigs, [
      ({projectSlug}) => projectSlug,
      ({id}) => parseInt(id, 10),
    ]);
  }, [fetchedPathConfigs]);

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

  const {mutate: deletePathConfig} = useDeletePathConfig();

  const openCodeMappingModal = useCallback(
    (pathConfig?: RepositoryProjectPathConfig) => {
      trackAnalytics('integrations.stacktrace_start_setup', {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: integration.provider.key,
        organization,
      });

      openModal(({Body, Header, closeModal}) => (
        <Fragment>
          <Header closeButton>
            <h4>{t('Configure code path mapping')}</h4>
          </Header>
          <Body>
            <RepositoryProjectPathConfigForm
              organization={organization}
              integration={integration}
              projects={projects}
              repos={repos}
              onSubmitSuccess={() => {
                trackAnalytics('integrations.stacktrace_complete_setup', {
                  setup_type: 'manual',
                  view: 'integration_configuration_detail',
                  provider: integration.provider.key,
                  organization,
                });
                refetchPathConfigs();
                closeModal();
              }}
              existingConfig={pathConfig}
              onCancel={closeModal}
            />
          </Body>
        </Fragment>
      ));
    },
    [repos, projects, integration, organization, refetchPathConfigs]
  );

  const isLoading = isPendingPathConfigs || isPendingRepos;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isErrorPathConfigs) {
    return <LoadingError message={t('Error loading code mappings')} />;
  }

  if (isErrorRepos) {
    return <LoadingError message={t('Error loading repositories')} />;
  }

  const pathConfigsPageLinks = getPathConfigsResponseHeader?.('Link');
  const docsLink = getDocsLink(integration);

  return (
    <Fragment>
      <TextBlock>
        {tct(
          `Code Mappings are used to map stack trace file paths to source code file paths. These mappings are the basis for features like Stack Trace Linking. To learn more, [link: read the docs].`,
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

      <Panel>
        <PanelHeader disablePadding hasButtons>
          <HeaderLayout>
            <NameRepoColumn>{t('Code Mappings')}</NameRepoColumn>
            <InputPathColumn>{t('Stack Trace Root')}</InputPathColumn>
            <OutputPathColumn>{t('Source Code Root')}</OutputPathColumn>
            <ButtonWrapper>
              <Button
                data-test-id="add-mapping-button"
                onClick={() => openCodeMappingModal()}
                size="xs"
                icon={<IconAdd />}
              >
                {t('Add Code Mapping')}
              </Button>
            </ButtonWrapper>
          </HeaderLayout>
        </PanelHeader>
        <PanelBody>
          {pathConfigs.length === 0 && (
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
          )}
          {pathConfigs
            .map(pathConfig => {
              const project = getMatchingProject(pathConfig);
              // this should never happen since our pathConfig would be deleted
              // if project was deleted
              if (!project) {
                return null;
              }
              return (
                <PanelItem key={pathConfig.id}>
                  <Layout>
                    <RepositoryProjectPathConfigRow
                      pathConfig={pathConfig}
                      project={project}
                      onEdit={openCodeMappingModal}
                      onDelete={() => deletePathConfig(pathConfig)}
                    />
                  </Layout>
                </PanelItem>
              );
            })
            .filter(item => !!item)}
        </PanelBody>
      </Panel>
      {pathConfigsPageLinks && <Pagination pageLinks={pathConfigsPageLinks} />}
    </Fragment>
  );
}

const Layout = styled('div')`
  display: grid;
  grid-column-gap: ${space(1)};
  width: 100%;
  align-items: center;
  grid-template-columns: 4.5fr 2.5fr 2.5fr max-content;
  grid-template-areas: 'name-repo input-path output-path button';
`;

const HeaderLayout = styled(Layout)`
  align-items: center;
  margin: 0 ${space(1)} 0 ${space(2)};
`;
