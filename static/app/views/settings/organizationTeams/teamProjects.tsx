import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconFlag, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ProjectListItem from 'sentry/views/settings/components/settingsProjectItem';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {useTeamDetailsOutlet} from 'sentry/views/settings/organizationTeams/teamDetails';

export default function TeamProjects() {
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const [query, setQuery] = useState<string>('');
  const {team} = useTeamDetailsOutlet();
  const {
    data: linkedProjects,
    isError: linkedProjectsError,
    isPending: linkedProjectsLoading,
    getResponseHeader: linkedProjectsHeaders,
    refetch: refetchLinkedProjects,
  } = useApiQuery<Project[]>(
    [
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          query: `team:${team.slug}`,
          cursor: location.query.cursor,
        },
      },
    ],
    {staleTime: 0}
  );
  const {
    data: unlinkedProjects = [],
    isPending: loadingUnlinkedProjects,
    refetch: refetchUnlinkedProjects,
  } = useApiQuery<Project[]>(
    [
      `/organizations/${organization.slug}/projects/`,
      {
        query: {query: query ? `!team:${team.slug} ${query}` : `!team:${team.slug}`},
      },
    ],
    {staleTime: 0}
  );

  const handleLinkProject = (project: Project, action: string) => {
    api.request(`/projects/${organization.slug}/${project.slug}/teams/${team.slug}/`, {
      method: action === 'add' ? 'POST' : 'DELETE',
      success: resp => {
        refetchLinkedProjects();
        refetchUnlinkedProjects();
        ProjectsStore.onUpdateSuccess(resp);
        addSuccessMessage(
          action === 'add'
            ? t('Successfully added project to team.')
            : t('Successfully removed project from team')
        );
      },
      error: () => {
        addErrorMessage(t("Wasn't able to change project association."));
      },
    });
  };

  const linkedProjectsPageLinks = linkedProjectsHeaders?.('Link');
  const hasWriteAccess = hasEveryAccess(['team:write'], {organization, team});
  const otherProjects = useMemo(() => {
    return unlinkedProjects
      .filter(p => p.access.includes('project:write'))
      .map<SelectOption<string>>(p => ({
        value: p.id,
        leadingItems: <ProjectAvatar project={p} size={16} />,
        label: p.slug,
        hideCheck: true,
      }));
  }, [unlinkedProjects]);

  return (
    <Fragment>
      <TextBlock>
        {t(
          'If you have Team Admin permissions for other projects, you can associate them with this team.'
        )}
      </TextBlock>
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Projects')}</div>
          <div>
            <CompactSelect
              size="xs"
              menuWidth={300}
              options={otherProjects}
              value=""
              disabled={false}
              onClose={() => setQuery('')}
              onChange={selection => {
                const project = unlinkedProjects.find(p => p.id === selection.value);
                if (project) {
                  handleLinkProject(project, 'add');
                }
              }}
              menuTitle={t('Projects')}
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps}>
                  {t('Add Project')}
                </OverlayTrigger.Button>
              )}
              searchPlaceholder={t('Search Projects')}
              emptyMessage={t('No projects')}
              loading={loadingUnlinkedProjects}
              searchable
              disableSearchFilter
              onSearch={setQuery}
            />
          </div>
        </PanelHeader>

        <PanelBody>
          {linkedProjectsError && (
            <LoadingError onRetry={() => refetchLinkedProjects()} />
          )}
          {linkedProjectsLoading && <LoadingIndicator />}
          {linkedProjects?.length ? (
            sortProjects(linkedProjects).map(project => (
              <StyledPanelItem key={project.id}>
                <ProjectListItem project={project} organization={organization} />
                <Tooltip
                  disabled={hasWriteAccess}
                  title={t(
                    'You do not have enough permission to change project association.'
                  )}
                >
                  <Button
                    size="sm"
                    disabled={!hasWriteAccess}
                    icon={<IconSubtract />}
                    aria-label={t('Remove')}
                    onClick={() => {
                      handleLinkProject(project, 'remove');
                    }}
                  >
                    {t('Remove')}
                  </Button>
                </Tooltip>
              </StyledPanelItem>
            ))
          ) : linkedProjectsLoading ? null : (
            <EmptyMessage size="lg" icon={<IconFlag />}>
              {t("This team doesn't have access to any projects.")}
            </EmptyMessage>
          )}
        </PanelBody>
      </Panel>
      <Pagination pageLinks={linkedProjectsPageLinks} />
    </Fragment>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
  max-width: 100%;
`;
