import {useCallback, useContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import {PlatformIcon} from 'platformicons';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import type {Platform} from 'sentry/components/platformPicker';
import PlatformPicker from 'sentry/components/platformPicker';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import TeamSelector from 'sentry/components/teamSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {
  MultipleCheckboxOptions,
  useCreateNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import IssueAlertOptions, {
  MetricValues,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';
import {GettingStartedWithProjectContext} from 'sentry/views/projects/gettingStartedWithProjectContext';

export type IssueAlertFragment = Parameters<
  React.ComponentProps<typeof IssueAlertOptions>['onChange']
>[0];

function CreateProject() {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);
  const {teams} = useTeams();

  const autoFill =
    location.query.referrer === 'getting-started' &&
    location.query.project === gettingStartedWithProjectContext.project?.id;

  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));

  useRouteAnalyticsEventNames(
    'project_creation_page.viewed',
    'Project Create: Creation page viewed'
  );

  const [projectName, setProjectName] = useState(
    autoFill ? gettingStartedWithProjectContext.project?.name : ''
  );
  const [platform, setPlatform] = useState<OnboardingSelectedSDK | undefined>(
    autoFill ? gettingStartedWithProjectContext.project?.platform : undefined
  );
  const [team, setTeam] = useState(
    autoFill
      ? gettingStartedWithProjectContext.project?.teamSlug ?? accessTeams?.[0]?.slug
      : accessTeams?.[0]?.slug
  );

  const [errors, setErrors] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  const [alertRuleConfig, setAlertRuleConfig] = useState<IssueAlertFragment | undefined>(
    undefined
  );

  const {createNotificationAction, notificationProps} = useCreateNotificationAction();

  const createProject = useCallback(
    async (selectedFramework?: OnboardingSelectedSDK) => {
      const {slug} = organization;
      const {
        shouldCreateRule,
        shouldCreateCustomRule,
        name,
        conditions,
        actions,
        actionMatch,
        frequency,
        defaultRules,
      } = alertRuleConfig || {};

      const selectedPlatform = selectedFramework ?? platform;

      if (!selectedPlatform) {
        addErrorMessage(t('Please select a platform in Step 1'));
        return;
      }

      setInFlight(true);

      try {
        const url = team
          ? `/teams/${slug}/${team}/projects/`
          : `/organizations/${slug}/experimental/projects/`;
        const projectData = await api.requestPromise(url, {
          method: 'POST',
          data: {
            name: projectName,
            platform: selectedPlatform.key,
            default_rules: defaultRules ?? true,
          },
        });

        const ruleIds: string[] = [];
        if (shouldCreateCustomRule) {
          const ruleData = await api.requestPromise(
            `/projects/${organization.slug}/${projectData.slug}/rules/`,
            {
              method: 'POST',
              data: {
                name,
                conditions,
                actions,
                actionMatch,
                frequency,
              },
            }
          );
          ruleIds.push(ruleData.id);
        }
        const ruleData = await createNotificationAction({
          shouldCreateRule,
          name,
          projectSlug: projectData.slug,
          conditions,
          actionMatch,
          frequency,
        });
        if (ruleData) {
          ruleIds.push(ruleData.id);
        }
        trackAnalytics('project_creation_page.created', {
          organization,
          issue_alert: defaultRules
            ? 'Default'
            : shouldCreateCustomRule
              ? 'Custom'
              : 'No Rule',
          project_id: projectData.id,
          platform: selectedPlatform.key,
          rule_ids: ruleIds,
        });

        ProjectsStore.onCreateSuccess(projectData, organization.slug);

        if (team) {
          addSuccessMessage(t('Created project %s', `${projectData.slug}`));
        } else {
          addSuccessMessage(
            t(
              'Created %s under new team %s',
              `${projectData.slug}`,
              `#${projectData.team_slug}`
            )
          );
        }

        browserHistory.push(
          normalizeUrl(
            `/organizations/${organization.slug}/projects/${projectData.slug}/getting-started/`
          )
        );
      } catch (err) {
        setInFlight(false);
        setErrors(err.responseJSON);
        addErrorMessage(t('Failed to create project %s', `${projectName}`));

        // Only log this if the error is something other than:
        // * The user not having access to create a project, or,
        // * A project with that slug already exists
        if (err.status !== 403 && err.status !== 409) {
          Sentry.withScope(scope => {
            scope.setExtra('err', err);
            Sentry.captureMessage('Project creation failed');
          });
        }
      }
    },
    [
      api,
      alertRuleConfig,
      organization,
      platform,
      projectName,
      team,
      createNotificationAction,
    ]
  );

  const handleProjectCreation = useCallback(async () => {
    const selectedPlatform = platform;

    if (!selectedPlatform) {
      addErrorMessage(t('Please select a platform in Step 1'));
      return;
    }

    if (
      selectedPlatform.type !== 'language' ||
      !Object.values(SupportedLanguages).includes(
        selectedPlatform.language as SupportedLanguages
      )
    ) {
      createProject();
      return;
    }

    const {FrameworkSuggestionModal, modalCss} = await import(
      'sentry/components/onboarding/frameworkSuggestionModal'
    );

    openModal(
      deps => (
        <FrameworkSuggestionModal
          {...deps}
          organization={organization}
          selectedPlatform={selectedPlatform}
          onConfigure={selectedFramework => {
            createProject(selectedFramework);
          }}
          onSkip={createProject}
        />
      ),
      {
        modalCss,
        onClose: () => {
          trackAnalytics('project_creation.select_framework_modal_close_button_clicked', {
            platform: selectedPlatform.key,
            organization,
          });
        },
      }
    );
  }, [platform, createProject, organization]);

  function handlePlatformChange(selectedPlatform: Platform | null) {
    if (!selectedPlatform?.id) {
      setPlatform(undefined);
      setProjectName('');
      return;
    }

    const userModifiedName = !!projectName && projectName !== platform?.key;
    const newName = userModifiedName ? projectName : selectedPlatform.id;

    setPlatform({
      ...omit(selectedPlatform, 'id'),
      key: selectedPlatform.id,
    });

    setProjectName(newName);
  }

  const {shouldCreateRule, shouldCreateCustomRule, conditions} = alertRuleConfig || {};
  const canUserCreateProject = canCreateProject(organization);

  const canCreateTeam = organization.access.includes('project:admin');
  const isOrgMemberWithNoAccess = accessTeams.length === 0 && !canCreateTeam;

  const isMissingTeam = !isOrgMemberWithNoAccess && !team;
  const isMissingProjectName = projectName === '';
  const isMissingAlertThreshold =
    shouldCreateCustomRule && !conditions?.every?.(condition => condition.value);
  const isMissingMessagingIntegrationChannel =
    shouldCreateRule &&
    notificationProps.actions?.some(
      action => action === MultipleCheckboxOptions.INTEGRATION
    ) &&
    !notificationProps.channel;

  const formErrorCount = [
    isMissingTeam,
    isMissingProjectName,
    isMissingAlertThreshold,
    isMissingMessagingIntegrationChannel,
  ].filter(value => value).length;

  const canSubmitForm = !inFlight && canUserCreateProject && formErrorCount === 0;

  let submitTooltipText: string = t('Please select a team');
  if (formErrorCount > 1) {
    submitTooltipText = t('Please fill out all the required fields');
  } else if (isMissingProjectName) {
    submitTooltipText = t('Please provide a project name');
  } else if (isMissingAlertThreshold) {
    submitTooltipText = t('Please provide an alert threshold');
  } else if (isMissingMessagingIntegrationChannel) {
    submitTooltipText = t(
      'Please provide an integration channel for alert notifications'
    );
  }

  const keyToErrorText = {
    actions: t('Notify via integration'),
    conditions: t('Alert conditions'),
    name: t('Alert name'),
    detail: t('Project details'),
  };

  const alertFrequencyDefaultValues = useMemo(() => {
    if (!autoFill) {
      return {};
    }

    const alertRules = gettingStartedWithProjectContext.project?.alertRules;

    if (alertRules?.length === 0) {
      return {
        alertSetting: String(RuleAction.CREATE_ALERT_LATER),
      };
    }

    if (
      alertRules?.[0]!.conditions?.[0]!.id?.endsWith('EventFrequencyCondition') ||
      alertRules?.[0]!.conditions?.[0]!.id?.endsWith('EventUniqueUserFrequencyCondition')
    ) {
      return {
        alertSetting: String(RuleAction.CUSTOMIZED_ALERTS),
        interval: String(alertRules?.[0]!.conditions?.[0]!.interval),
        threshold: String(alertRules?.[0]!.conditions?.[0]!.value),
        metric: alertRules?.[0]!.conditions?.[0]!.id?.endsWith('EventFrequencyCondition')
          ? MetricValues.ERRORS
          : MetricValues.USERS,
      };
    }

    return {
      alertSetting: String(RuleAction.DEFAULT_ALERT),
    };
  }, [autoFill, gettingStartedWithProjectContext.project?.alertRules]);

  return (
    <Access access={canUserCreateProject ? ['project:read'] : ['project:admin']}>
      <div data-test-id="onboarding-info">
        <List symbol="colored-numeric">
          <Layout.Title withMargins>{t('Create a new project in 3 steps')}</Layout.Title>
          <HelpText>
            {tct(
              'Set up a separate project for each part of your application (for example, your API server and frontend client), to quickly pinpoint which part of your application errors are coming from. [link: Read the docs].',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/" />
                ),
              }
            )}
          </HelpText>
          <StyledListItem>{t('Choose your platform')}</StyledListItem>
          <PlatformPicker
            platform={platform?.key}
            defaultCategory={platform?.category}
            setPlatform={handlePlatformChange}
            organization={organization}
            showOther
            noAutoFilter
          />
          <StyledListItem>{t('Set your alert frequency')}</StyledListItem>
          <IssueAlertOptions
            {...alertFrequencyDefaultValues}
            platformLanguage={platform?.language as SupportedLanguages}
            onChange={updatedData => setAlertRuleConfig(updatedData)}
            notificationProps={notificationProps}
          />
          <StyledListItem>{t('Name your project and assign it a team')}</StyledListItem>
          <CreateProjectForm
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              // Prevent the page from reloading
              event.preventDefault();
              handleProjectCreation();
            }}
          >
            <div>
              <FormLabel>{t('Project name')}</FormLabel>
              <ProjectNameInputWrap>
                <StyledPlatformIcon platform={platform?.key ?? 'other'} size={20} />
                <ProjectNameInput
                  type="text"
                  name="name"
                  placeholder={t('project-name')}
                  autoComplete="off"
                  value={projectName}
                  onChange={e => setProjectName(slugify(e.target.value))}
                />
              </ProjectNameInputWrap>
            </div>
            {!isOrgMemberWithNoAccess && (
              <div>
                <FormLabel>{t('Team')}</FormLabel>
                <TeamSelectInput>
                  <TeamSelector
                    allowCreate
                    name="select-team"
                    aria-label={t('Select a Team')}
                    menuPlacement="auto"
                    clearable={false}
                    value={team}
                    placeholder={t('Select a Team')}
                    onChange={choice => setTeam(choice.value)}
                    teamFilter={(tm: Team) => tm.access.includes('team:admin')}
                  />
                </TeamSelectInput>
              </div>
            )}
            <div>
              <Tooltip title={submitTooltipText} disabled={formErrorCount === 0}>
                <Button
                  type="submit"
                  data-test-id="create-project"
                  priority="primary"
                  disabled={!canSubmitForm}
                >
                  {t('Create Project')}
                </Button>
              </Tooltip>
            </div>
          </CreateProjectForm>

          {errors && (
            <Alert type="error">
              {Object.keys(errors).map(key => (
                <div key={key}>
                  <strong>{keyToErrorText[key] ?? startCase(key)}</strong>: {errors[key]}
                </div>
              ))}
            </Alert>
          )}
        </List>
      </div>
    </Access>
  );
}

export {CreateProject};

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const CreateProjectForm = styled('form')`
  display: grid;
  grid-template-columns: 300px minmax(250px, max-content) max-content;
  gap: ${space(2)};
  align-items: end;
  padding: ${space(3)} 0;
  background: ${p => p.theme.background};
`;

const FormLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const ProjectNameInputWrap = styled('div')`
  position: relative;
`;

const ProjectNameInput = styled(Input)`
  padding-left: calc(${p => p.theme.formPadding.md.paddingLeft}px * 1.5 + 20px);
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: 50%;
  left: ${p => p.theme.formPadding.md.paddingLeft}px;
  transform: translateY(-50%);
`;

const TeamSelectInput = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr min-content;
  align-items: center;
`;

const HelpText = styled('p')`
  color: ${p => p.theme.subText};
  max-width: 760px;
`;
