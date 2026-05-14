import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Access} from 'sentry/components/acl/access';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getDisplayName} from 'sentry/utils/environment';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

interface EnvironmentRowProps {
  name: React.ReactNode;
  children?: React.ReactNode;
}

interface ProjectEnvironment {
  id: string;
  isHidden: boolean;
  name: string;
}

interface ToggleEnvironmentVariables {
  environment: ProjectEnvironment;
  shouldHide: boolean;
}

function EnvironmentRow({children, name}: EnvironmentRowProps) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell minHeight="45px" padding="md xl">
        {name}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" minHeight="45px" padding="md xl">
        {children}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function EnvironmentTableSkeleton({isHidden}: {isHidden: boolean}) {
  return (
    <Fragment>
      {!isHidden && <EnvironmentRow name={t('All Environments')} />}
      {['35%', '28%', '42%', '24%'].map(width => (
        <SimpleTable.Row key={width}>
          <SimpleTable.RowCell minHeight="40px" padding="md xl">
            <Placeholder height="16px" width={width} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end" minHeight="40px" padding="md xl">
            <Placeholder height="24px" width="44px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

export default function ProjectEnvironments() {
  const location = useLocation();
  const params = useParams<{projectId: string}>();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const queryClient = useQueryClient();

  const isHidden = location.pathname.endsWith('hidden/');
  const environmentsQueryOptions = apiOptions.as<ProjectEnvironment[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: params.projectId,
      },
      query: {visibility: isHidden ? 'hidden' : 'visible'},
      staleTime: 0,
    }
  );
  const {
    data: environments,
    isPending,
    isError,
    refetch,
  } = useQuery(environmentsQueryOptions);

  const toggleEnvironment = useMutation({
    mutationFn: ({environment, shouldHide}: ToggleEnvironmentVariables) =>
      fetchMutation({
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/environments/$environment/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: params.projectId,
              // Django decodes route params before the endpoint calls
              // `Environment.get_name_from_path_segment()`, which unquotes the value again.
              // Pre-encode here so `getApiUrl`'s normal path-param encoding produces the
              // double-encoded URL needed to preserve literal percent sequences in names.
              environment: encodeURIComponent(environment.name),
            },
          }
        ),
        method: 'PUT',
        data: {isHidden: shouldHide},
      }),
    onMutate: async ({environment}) => {
      await queryClient.cancelQueries({queryKey: environmentsQueryOptions.queryKey});

      const previousData = queryClient.getQueryData(environmentsQueryOptions.queryKey);

      queryClient.setQueryData(environmentsQueryOptions.queryKey, previous =>
        previous
          ? {
              ...previous,
              json: previous.json.filter(env => env.id !== environment.id),
            }
          : previous
      );

      return {previousData};
    },
    onSuccess: (_data, {environment, shouldHide}) => {
      addSuccessMessage(
        shouldHide
          ? t('Hidden %s', getDisplayName(environment))
          : t('Unhidden %s', getDisplayName(environment))
      );
    },
    onError: (_error, {environment, shouldHide}, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(environmentsQueryOptions.queryKey, context.previousData);
      }

      addErrorMessage(
        shouldHide
          ? t('Unable to hide %s', getDisplayName(environment))
          : t('Unable to unhide %s', getDisplayName(environment))
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: environmentsQueryOptions.queryKey});
    },
  });

  return (
    <div>
      <SentryDocumentTitle title={t('Environments')} projectSlug={params.projectId} />
      <SettingsPageHeader
        title={t('Manage Environments')}
        tabs={
          <TabsContainer>
            <Tabs value={isHidden ? 'hidden' : 'environments'}>
              <TabList>
                <TabList.Item
                  key="environments"
                  to={`/settings/${organization.slug}/projects/${params.projectId}/environments/`}
                >
                  {t('Environments')}
                </TabList.Item>
                <TabList.Item
                  key="hidden"
                  to={`/settings/${organization.slug}/projects/${params.projectId}/environments/hidden/`}
                >
                  {t('Hidden')}
                </TabList.Item>
              </TabList>
            </Tabs>
          </TabsContainer>
        }
      />
      <ProjectPermissionAlert project={project} />

      <EnvironmentTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>
            {isHidden ? t('Hidden') : t('Active Environments')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.Header>
        {isPending ? (
          <EnvironmentTableSkeleton isHidden={isHidden} />
        ) : isError ? (
          <SimpleTable.Empty>
            <LoadingError onRetry={refetch} />
          </SimpleTable.Empty>
        ) : environments?.length ? (
          <Fragment>
            {!isHidden && <EnvironmentRow name={t('All Environments')} />}
            {environments.map(env => (
              <EnvironmentRow key={env.id} name={env.name}>
                <Access access={['project:write']} project={project}>
                  {({hasAccess}) => (
                    <Button
                      size="xs"
                      disabled={!hasAccess}
                      onClick={() =>
                        toggleEnvironment.mutate({
                          environment: env,
                          shouldHide: !isHidden,
                        })
                      }
                    >
                      {isHidden ? t('Show') : t('Hide')}
                    </Button>
                  )}
                </Access>
              </EnvironmentRow>
            ))}
          </Fragment>
        ) : (
          <SimpleTable.Empty>
            {isHidden
              ? t("You don't have any hidden environments.")
              : t("You don't have any environments yet.")}
          </SimpleTable.Empty>
        )}
      </EnvironmentTable>
    </div>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

const EnvironmentTable = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1fr) max-content;
`;
