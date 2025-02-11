import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import NotificationActionManager from 'sentry/components/notificationActions/notificationActionManager';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  AvailableNotificationAction,
  NotificationAction,
} from 'sentry/types/notificationActions';
import type {Project} from 'sentry/types/project';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {ProjectBadge} from 'sentry/views/organizationStats/teamInsights/styles';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import trackSpendVisibilityAnaltyics, {
  SpendVisibilityEvents,
} from 'getsentry/utils/trackSpendVisibilityAnalytics';
import {
  SPIKE_PROTECTION_ERROR_MESSAGE,
  SPIKE_PROTECTION_OPTION_DISABLED,
} from 'getsentry/views/spikeProtection/constants';
import SpikeProtectionProjectToggle, {
  isSpikeProtectionEnabled,
} from 'getsentry/views/spikeProtection/spikeProtectionProjectToggle';

import AccordionRow from './components/accordionRow';

interface Props {
  subscription: Subscription;
}

function SpikeProtectionProjects({subscription}: Props) {
  const [projects, setProjects] = useState([] as Project[]);
  const [pageLinks, setPageLinks] = useState<string | null>();
  const [currentCursor, setCurrentCursor] = useState<string | undefined>('');
  const [availableNotificationActions, setAvailableNotificationActions] = useState<
    AvailableNotificationAction[]
  >([]);
  const [notificationActionsById, setNotificationActionsById] = useState<
    Record<string, NotificationAction[]>
  >({});
  const [isFetchingProjects, setIsFetchingProjects] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const organization = useOrganization();
  const api = useApi();
  const debouncedSearch = useRef(
    debounce(value => {
      fetchProjects(value);
    }, DEFAULT_DEBOUNCE_DURATION)
  ).current;
  const triggerType = 'spike-protection';
  const hasOrgAdmin = organization.access.includes('org:admin');
  const hasOrgWrite = organization.access.includes('org:write') || hasOrgAdmin;

  const fetchProjects = useCallback(
    async (query: string = '') => {
      let accessibleProjectsQuery = query;
      if (!organization.openMembership && !isActiveSuperuser() && !hasOrgAdmin) {
        accessibleProjectsQuery += ' is_member:1';
      }
      setIsFetchingProjects(true);
      const [data, _, resp] = await api.requestPromise(
        `/organizations/${organization.slug}/projects/`,
        {
          includeAllArgs: true,
          query: {
            cursor: currentCursor,
            query: accessibleProjectsQuery,
            options: SPIKE_PROTECTION_OPTION_DISABLED,
          },
        }
      );
      setProjects(data);
      const links =
        (resp?.getResponseHeader('Link') || resp?.getResponseHeader('link')) ?? undefined;
      setPageLinks(links);

      if (query.length > 0) {
        trackSpendVisibilityAnaltyics(SpendVisibilityEvents.SP_PROJECT_SEARCHED, {
          organization,
          subscription,
          view: 'spike_protection_settings',
        });
      }
      setIsFetchingProjects(false);
    },
    [api, currentCursor, organization, subscription, hasOrgAdmin]
  );

  const fetchAvailableNotificationActions = useCallback(async () => {
    const data = await api.requestPromise(
      `/organizations/${organization.slug}/notifications/available-actions/`
    );
    setAvailableNotificationActions(data.actions);
  }, [api, organization]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchAvailableNotificationActions();
    } catch (err) {
      Sentry.captureException(err);
      addErrorMessage(t('Unable to fetch available notification actions'));
    }
    setIsLoading(false);
  }, [fetchAvailableNotificationActions]);

  const fetchProjectNotificationActions = useCallback(
    async (
      project: Project,
      projectNotificationActions: Record<string, NotificationAction[]>
    ) => {
      const projectId = project.id;
      const data = await api.requestPromise(
        `/organizations/${organization.slug}/notifications/actions/`,
        {query: {triggerType, project: projectId}}
      );

      const notifActionsById = {...projectNotificationActions};
      data.forEach((action: NotificationAction) => {
        if (notifActionsById[projectId]) {
          notifActionsById[projectId].push(action);
        } else {
          notifActionsById[projectId] = [action];
        }
      });
      setNotificationActionsById(notifActionsById);
    },
    [api, organization]
  );

  const updateAllProjects = useCallback(
    async (isEnabling: boolean) => {
      try {
        await api.requestPromise(
          `/organizations/${organization.slug}/spike-protections/?projectSlug=$all`,
          {method: isEnabling ? 'POST' : 'DELETE', data: {projects: []}}
        );
        const newProjects = projects.map(p => ({
          ...p,
          options: {...p.options, [SPIKE_PROTECTION_OPTION_DISABLED]: !isEnabling},
        }));
        setProjects(newProjects);
        await fetchData();
        addSuccessMessage(
          tct(`[action] spike protection for all projects`, {
            action: isEnabling ? t('Enabled') : t('Disabled'),
          })
        );
      } catch (err) {
        Sentry.captureException(err);
        addErrorMessage(SPIKE_PROTECTION_ERROR_MESSAGE);
      }
    },
    [api, organization, projects, fetchData]
  );

  useEffect(() => {
    fetchProjects();
    fetchData();
  }, [fetchProjects, fetchData]);

  function toggleSpikeProtectionOption(project: Project, isFeatureEnabled: boolean) {
    const updatedProject = {
      ...project,
      options: {
        ...project.options,
        // If the project option is True, the feature is disabled
        // Therefore, if the newValue of the field is True, the option must be set to False
        [SPIKE_PROTECTION_OPTION_DISABLED]: !isFeatureEnabled,
      },
    };
    const newProjects = projects.map(p => (p.id !== project.id ? p : updatedProject));
    setProjects(newProjects);
  }

  const onChange = useCallback(
    (value: any) => {
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  function AllProjectsAction(isEnabling: boolean) {
    const action = isEnabling ? t('Enable') : t('Disable');
    const confirmationText = tct(
      `This will [action] spike protection for all projects in the organization immediately. Are you sure?`,
      {action: action.toLowerCase()}
    );
    return (
      <Confirm
        onConfirm={() => updateAllProjects(isEnabling)}
        message={confirmationText}
        disabled={!hasOrgWrite}
      >
        <Button
          disabled={!hasOrgWrite}
          priority={isEnabling ? 'primary' : 'default'}
          data-test-id={`sp-${action.toLowerCase()}-all`}
          title={
            !hasOrgWrite
              ? tct(
                  `You do not have permission to [action] spike protection for all projects.`,
                  {action: action.toLowerCase()}
                )
              : undefined
          }
        >
          {tct('[action] All', {action})}
        </Button>
      </Confirm>
    );
  }

  const renderAccordionTitle = (project: Project) => {
    return (
      <StyledAccordionTitle>
        <AccordionTitleCell>
          <StyledProjectBadge hideOverflow project={project} displayName={project.slug} />
        </AccordionTitleCell>
      </StyledAccordionTitle>
    );
  };

  const renderAccordionBody = (project: Project) => {
    const projectNotificationActions: NotificationAction[] =
      notificationActionsById[project.id] ?? [];

    // Only render if all of the notification actions have been loaded
    if (isLoading) {
      return null;
    }

    const hasProjectWrite = project.access.includes('project:write');

    return (
      <StyledAccordionDetails>
        <NotificationActionManager
          actions={projectNotificationActions}
          availableActions={availableNotificationActions}
          recipientRoles={['owner', 'manager', 'billing']}
          project={project}
          disabled={!hasOrgWrite && !hasProjectWrite}
        />
      </StyledAccordionDetails>
    );
  };

  return (
    <Fragment>
      <Container>
        <StyledSearch placeholder={t('Search projects')} onChange={onChange} />
        <StyledButtonBar merged>
          {AllProjectsAction(false)}
          {AllProjectsAction(true)}
        </StyledButtonBar>
      </Container>
      <StyledPanelTable
        disablePadding={
          organization.features.includes('notification-actions') ? true : false
        }
        isEmpty={!projects.length}
        headers={[
          <StyledPanelTableHeader key={0}>{t('Projects')}</StyledPanelTableHeader>,
        ]}
        isLoading={isLoading || isFetchingProjects}
      >
        {projects?.map(project => {
          const hasProjectWrite = project.access.includes('project:write');
          const accordionTitle = renderAccordionTitle(project);
          const accordionBody = renderAccordionBody(project);
          const isAccordionDisabled = !isSpikeProtectionEnabled(project);

          return (
            <Fragment key={project.id}>
              <AccordionRowContainer
                data-test-id={`${project.slug}-accordion-row${
                  isAccordionDisabled ? '-disabled' : ''
                }`}
              >
                <StyledPanelToggle
                  project={project}
                  disabled={!hasOrgWrite && !hasProjectWrite}
                  analyticsView="spike_protection_settings"
                  onChange={(isEnabled: any) =>
                    toggleSpikeProtectionOption(project, isEnabled)
                  }
                />
                <AccordionRow
                  disabled={isAccordionDisabled}
                  disableBody={isLoading}
                  title={accordionTitle}
                  body={accordionBody}
                  onOpen={() =>
                    fetchProjectNotificationActions(project, notificationActionsById)
                  }
                />
              </AccordionRowContainer>
            </Fragment>
          );
        })}
      </StyledPanelTable>
      {pageLinks && <Pagination pageLinks={pageLinks} onCursor={setCurrentCursor} />}
    </Fragment>
  );
}

export default withSubscription(SpikeProtectionProjects);

const Container = styled('div')`
  margin-bottom: ${space(2)};
  justify-content: space-between;
  display: flex;
`;

const StyledSearch = styled(SearchBar)`
  flex: 1;
`;

const StyledPanelTable = styled(PanelTable)`
  align-items: center;
  overflow: visible;
`;

const StyledProjectBadge = styled(ProjectBadge)`
  font-weight: bold;
`;

const StyledAccordionTitle = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  width: 100%;
`;

const AccordionRowContainer = styled('div')`
  display: flex;
  width: 100%;
  padding: ${space(1.5)};
  padding-left: 0;
`;

const AccordionTitleCell = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(2)};
`;

const StyledAccordionDetails = styled('div')`
  margin-right: ${space(3)};
  margin-top: ${space(2)};
  padding-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledPanelTableHeader = styled('div')`
  padding-left: ${space(2)};
`;

const StyledPanelToggle = styled(SpikeProtectionProjectToggle)`
  height: 100%;
  border-bottom: none;
  padding: 0;
  padding-left: ${space(1)};
  align-items: start;
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-left: ${space(2)};
`;
