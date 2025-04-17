import {useCallback, useContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import {PlatformIcon} from 'platformicons';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import type {Platform} from 'sentry/components/platformPicker';
import PlatformPicker from 'sentry/components/platformPicker';
import TeamSelector from 'sentry/components/teamSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
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
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

export type IssueAlertFragment = Parameters<
  React.ComponentProps<typeof IssueAlertOptions>['onChange']
>[0];

function CreateProject() {
  const [errors, setErrors] = useState(false);
  const [alertRuleConfig, setAlertRuleConfig] = useState<IssueAlertFragment | undefined>(
    undefined
  );

  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);
  const {teams} = useTeams();
  const {createNotificationAction, notificationProps} = useCreateNotificationAction();
  const {
    shouldCreateRule,
    shouldCreateCustomRule,
    conditions,
    actions,
    frequency,
    actionMatch,
    defaultRules,
  } = alertRuleConfig || {};

  const createRules = useCallback(
    async (project: Project) => {
      const ruleIds = [];

      if (shouldCreateCustomRule) {
        const ruleData = await api.requestPromise(
          `/projects/${organization.slug}/${project.slug}/rules/`,
          {
            method: 'POST',
            data: {
              name: project.name,
              conditions,
              actions,
              actionMatch,
              frequency,
            },
          }
        );

        ruleIds.push(ruleData.id);
      }

      const notificationRule = await createNotificationAction({
        shouldCreateRule,
        name: project.name,
        projectSlug: project.slug,
        conditions,
        actionMatch,
        frequency,
      });

      if (notificationRule) {
        ruleIds.push(notificationRule.id);
      }

      return ruleIds;
    },
    [
      organization,
      api,
      shouldCreateRule,
      conditions,
      createNotificationAction,
      shouldCreateCustomRule,
      actionMatch,
      frequency,
      actions,
    ]
  );

  const createProject = useCreateProject();

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
      ? (gettingStartedWithProjectContext.project?.teamSlug ?? accessTeams?.[0]?.slug)
      : accessTeams?.[0]?.slug
  );

  const configurePlatform = useCallback(
    async (selectedFramework?: OnboardingSelectedSDK) => {
      const selectedPlatform = selectedFramework ?? platform;

      if (!selectedPlatform) {
        addErrorMessage(t('Please select a platform in Step 1'));
        return;
      }

      try {
        const project = await createProject.mutateAsync({
          name: projectName,
          platform: selectedPlatform,
          default_rules: alertRuleConfig?.defaultRules ?? true,
          firstTeamSlug: team,
        });

        const ruleIds = await createRules(project);

        trackAnalytics('project_creation_page.created', {
          organization,
          issue_alert: defaultRules
            ? 'Default'
            : shouldCreateCustomRule
              ? 'Custom'
              : 'No Rule',
          project_id: project.id,
          platform: selectedPlatform.key,
          rule_ids: ruleIds,
        });

        addSuccessMessage(
          team
            ? t('Created project %s', `${project.slug}`)
            : t(
                'Created %s under new team %s',
                `${project.slug}`,
                `#${project.team.slug}`
              )
        );

        browserHistory.push(
          normalizeUrl(
            makeProjectsPathname({
              orgSlug: organization.slug,
              path: `/${project.slug}/getting-started/`,
            })
          )
        );
      } catch (error) {
        setErrors(!!error.responseJSON);
        addErrorMessage(t('Failed to create project %s', `${projectName}`));

        // Only log this if the error is something other than:
        // * The user not having access to create a project, or,
        // * A project with that slug already exists
        if (error.status !== 403 && error.status !== 409) {
          Sentry.withScope(scope => {
            scope.setExtra('err', error);
            Sentry.captureMessage('Project creation failed');
          });
        }
      }
    },
    [
      createProject,
      projectName,
      platform,
      alertRuleConfig,
      team,
      createRules,
      organization,
      defaultRules,
      shouldCreateCustomRule,
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
      configurePlatform();
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
            configurePlatform(selectedFramework);
          }}
          onSkip={configurePlatform}
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
  }, [platform, configurePlatform, organization]);

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

  const canUserCreateProject = useCanCreateProject();

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

  const canSubmitForm =
    !createProject.isPending && canUserCreateProject && formErrorCount === 0;

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

  const keyToErrorText: Record<string, string> = {
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
                    onChange={(choice: any) => setTeam(choice.value)}
                    teamFilter={(tm: Team) => tm.access.includes('team:admin')}
                    minMenuHeight={240}
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
            <Alert.Container>
              <Alert type="error">
                {Object.keys(errors).map(key => (
                  <div key={key}>
                    <strong>{keyToErrorText[key] ?? startCase(key)}</strong>:{' '}
                    {(errors as any)[key]}
                  </div>
                ))}
              </Alert>
            </Alert.Container>
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
