import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {skipToken, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {IdBadge} from 'sentry/components/idBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import type {NotificationOptionsObject} from './constants';
import {OrganizationSelectHeader} from './organizationSelectHeader';

interface WeeklyReportProjectExclusionsProps {
  handleAddNotificationOption: (option: Omit<NotificationOptionsObject, 'id'>) => void;
  handleEditNotificationOption: (option: NotificationOptionsObject) => void;
  handleRemoveNotificationOption: (id: string) => void;
  notificationOptions: NotificationOptionsObject[];
  organizations: OrganizationSummary[];
}

const PAGE_SIZE = 15;

interface Exclusion {
  dateAdded: string;
  id: string;
  projectId: string;
  projectSlug: string;
}

function exclusionsApiOptions(
  orgSlug: string | typeof skipToken,
  regionUrl: string | undefined
) {
  return apiOptions.as<Exclusion[]>()(
    '/organizations/$organizationIdOrSlug/weekly-report-project-exclusions/',
    {
      path: orgSlug === skipToken ? skipToken : {organizationIdOrSlug: orgSlug},
      host: regionUrl,
      staleTime: 30_000,
    }
  );
}

export function WeeklyReportProjectExclusions({
  organizations,
  notificationOptions,
  handleAddNotificationOption,
  handleEditNotificationOption,
  handleRemoveNotificationOption,
}: WeeklyReportProjectExclusionsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);

  const customerDomain = ConfigStore.get('customerDomain');
  const orgFromSubdomain = organizations.find(
    ({slug}) => slug === customerDomain?.subdomain
  )?.id;

  const orgId =
    (location.query?.organizationId as string | undefined) ??
    orgFromSubdomain ??
    (organizations.length === 1 ? organizations[0]?.id : undefined);
  const organization = organizations.find(({id}) => id === orgId);

  useEffect(() => {
    setCurrentPage(0);
  }, [organization?.id]);

  const {
    data: projects,
    isPending: projectsPending,
    isError: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    ...apiOptions.as<Project[]>()('/organizations/$organizationIdOrSlug/projects/', {
      path: organization ? {organizationIdOrSlug: organization.slug} : skipToken,
      host: organization?.links?.regionUrl,
      query: {
        all_projects: '1',
        collapse: ['latestDeploys', 'unusedFeatures'],
      },
      staleTime: Infinity,
    }),
  });

  const exclusionsOpts = exclusionsApiOptions(
    organization?.slug ?? skipToken,
    organization?.links?.regionUrl
  );

  const {
    data: exclusions,
    isPending: exclusionsPending,
    isError: exclusionsError,
    refetch: refetchExclusions,
  } = useQuery({
    ...exclusionsOpts,
  });

  const excludedProjectIds = new Set((exclusions ?? []).map(exc => exc.projectId));

  const toggleMutation = useMutation({
    mutationFn: (newExcludedIds: string[]) =>
      fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization!.slug}/weekly-report-project-exclusions/`,
        options: {host: organization!.links?.regionUrl},
        data: {projectIds: newExcludedIds.map(Number)},
      }),
    onMutate: (newExcludedIds: string[]) => {
      const previousExclusions = queryClient.getQueryData(exclusionsOpts.queryKey);
      queryClient.setQueryData(exclusionsOpts.queryKey, {
        json: newExcludedIds.map(id => ({
          id,
          projectId: id,
          projectSlug: '',
          dateAdded: '',
        })),
        headers: {},
      });
      return {previousExclusions};
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated weekly report project exclusions'));
    },
    onError: (_error, _variables, context) => {
      if (context?.previousExclusions) {
        queryClient.setQueryData(exclusionsOpts.queryKey, context.previousExclusions);
      }
      addErrorMessage(t('Unable to update weekly report project exclusions'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: exclusionsOpts.queryKey});
    },
  });

  const handleToggle = (projectId: string) => {
    const newExcluded = new Set(excludedProjectIds);
    if (newExcluded.has(projectId)) {
      newExcluded.delete(projectId);
    } else {
      newExcluded.add(projectId);
    }
    toggleMutation.mutate([...newExcluded]);
  };

  const handleOrgChange = (organizationId: string) => {
    navigate(
      {
        ...location,
        query: {organizationId},
      },
      {replace: true}
    );
  };

  const userDefault = notificationOptions.find(
    o => o.type === 'reports' && o.scopeType === 'user'
  );
  const defaultEnabled = userDefault ? userDefault.value === 'always' : true;

  const orgOverride = organization
    ? notificationOptions.find(
        o =>
          o.type === 'reports' &&
          o.scopeType === 'organization' &&
          o.scopeIdentifier === organization.id
      )
    : undefined;
  const reportEnabled = orgOverride ? orgOverride.value === 'always' : defaultEnabled;

  const handleReportToggle = () => {
    if (!organization) {
      return;
    }
    if (orgOverride) {
      if (reportEnabled) {
        handleEditNotificationOption({...orgOverride, value: 'never'});
      } else {
        handleRemoveNotificationOption(orgOverride.id);
      }
    } else {
      handleAddNotificationOption({
        type: 'reports',
        scopeType: 'organization',
        scopeIdentifier: organization.id,
        value: 'never',
      });
    }
  };

  const isPending = projectsPending || exclusionsPending;
  const isError = projectsError || exclusionsError;

  const sortedProjects = [...(projects ?? [])]
    .filter(project => project.isMember)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const allExcluded =
    sortedProjects.length > 0 &&
    sortedProjects.every(p => excludedProjectIds.has(String(p.id)));

  const totalPages = Math.ceil(sortedProjects.length / PAGE_SIZE);
  const paginatedProjects = sortedProjects.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );
  const showPagination = sortedProjects.length > PAGE_SIZE;

  return (
    <Fragment>
      <Panel>
        <StyledPanelHeader>
          <OrganizationSelectHeader
            organizations={organizations}
            organizationId={orgId}
            handleOrgChange={handleOrgChange}
          />
          {organization && (
            <Select
              value={reportEnabled ? 'always' : 'never'}
              options={[
                {value: 'always', label: t('On')},
                {value: 'never', label: t('Off')},
              ]}
              onChange={({value}: {value: string}) => {
                if ((value === 'always') === reportEnabled) {
                  return;
                }
                handleReportToggle();
              }}
              aria-label={t('Toggle weekly report for %s', organization.name)}
            />
          )}
        </StyledPanelHeader>
        {organization ? (
          <Fragment>
            {reportEnabled && (
              <Fragment>
                {projectsPending && (
                  <PanelBody>
                    <LoadingIndicator />
                  </PanelBody>
                )}
                {projectsError && (
                  <PanelBody>
                    <LoadingError onRetry={refetchProjects} />
                  </PanelBody>
                )}
                {isPending && !projectsPending && (
                  <PanelBody>
                    <LoadingIndicator />
                  </PanelBody>
                )}
                {isError && !projectsError && (
                  <PanelBody>
                    <LoadingError
                      onRetry={() => {
                        refetchProjects();
                        refetchExclusions();
                      }}
                    />
                  </PanelBody>
                )}
                {!isPending && !isError && !projectsPending && !projectsError && (
                  <Fragment>
                    {allExcluded && (
                      <StyledAlert variant="warning">
                        {t(
                          "You won't receive a weekly report for this organization if all projects are excluded."
                        )}
                      </StyledAlert>
                    )}
                    <StyledPanelBody>
                      {sortedProjects.length === 0 ? (
                        <EmptyStateWarning withIcon={false}>
                          {t('No projects found')}
                        </EmptyStateWarning>
                      ) : (
                        paginatedProjects.map(project => (
                          <Item key={project.id}>
                            <IdBadge
                              project={project}
                              avatarSize={20}
                              avatarProps={{consistentWidth: true}}
                              disableLink
                            />
                            <Switch
                              size="lg"
                              checked={!excludedProjectIds.has(String(project.id))}
                              onChange={() => handleToggle(String(project.id))}
                              aria-label={t('Toggle weekly report for %s', project.slug)}
                            />
                          </Item>
                        ))
                      )}
                    </StyledPanelBody>
                    {showPagination && (
                      <Flex justify="end" align="center" margin="lg xl">
                        <PaginationCaption>
                          {tct('[start]-[end] of [total]', {
                            start: currentPage * PAGE_SIZE + 1,
                            end: Math.min(
                              (currentPage + 1) * PAGE_SIZE,
                              sortedProjects.length
                            ),
                            total: sortedProjects.length,
                          })}
                        </PaginationCaption>
                        <ButtonBar>
                          <Button
                            icon={<IconChevron direction="left" />}
                            aria-label={t('Previous')}
                            size="sm"
                            disabled={currentPage === 0}
                            onClick={() => setCurrentPage(p => p - 1)}
                          />
                          <Button
                            icon={<IconChevron direction="right" />}
                            aria-label={t('Next')}
                            size="sm"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() => setCurrentPage(p => p + 1)}
                          />
                        </ButtonBar>
                      </Flex>
                    )}
                  </Fragment>
                )}
              </Fragment>
            )}
          </Fragment>
        ) : (
          <PanelBody>
            <EmptyStateWarning withIcon={false}>
              {t('Select an organization to continue')}
            </EmptyStateWarning>
          </PanelBody>
        )}
      </Panel>
    </Fragment>
  );
}

const StyledAlert = styled(Alert)`
  margin: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  margin-bottom: 0;
`;

const StyledPanelHeader = styled(PanelHeader)`
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  & > form {
    flex-grow: 1;
  }
  & > div:last-child {
    min-width: 80px;
    flex-shrink: 0;
    font-weight: ${p => p.theme.font.weight.sans.regular};
    text-transform: none;
  }
`;

const StyledPanelBody = styled(PanelBody)`
  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const Item = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
`;

const PaginationCaption = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  margin-right: ${p => p.theme.space.xl};
`;
