import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import {PlatformIcon} from 'platformicons';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {removeProject} from 'sentry/actionCreators/projects';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {useCreateProjectRules} from 'sentry/components/onboarding/useCreateProjectRules';
import type {Platform} from 'sentry/components/platformPicker';
import PlatformPicker from 'sentry/components/platformPicker';
import TeamSelector from 'sentry/components/teamSelector';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {
  MultipleCheckboxOptions,
  useCreateNotificationAction,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import IssueAlertOptions, {
  MetricValues,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type FormData = {
  alertRuleConfig: Partial<RequestDataFragment>;
  projectName: string;
  platform?: Partial<OnboardingSelectedSDK>;
  team?: string;
};

type CreatedProject = Pick<Project, 'name' | 'id'> & {
  alertRule: Partial<RequestDataFragment> | undefined;
  platform: OnboardingSelectedSDK;
  team?: string;
};

function isNotPartialPlatform(
  platform: Partial<OnboardingSelectedSDK> | undefined
): platform is OnboardingSelectedSDK {
  return !!platform?.key;
}

function getMissingValues({
  team,
  projectName,
  conditions,
  notificationProps,
  shouldCreateRule,
  shouldCreateCustomRule,
  isOrgMemberWithNoAccess,
}: {
  isOrgMemberWithNoAccess: boolean;
  notificationProps: {
    actions?: string[];
    channel?: string;
  };
  projectName: string;
  team: string | undefined;
} & Partial<
  Pick<RequestDataFragment, 'conditions' | 'shouldCreateCustomRule' | 'shouldCreateRule'>
>) {
  return {
    isMissingTeam: !isOrgMemberWithNoAccess && !team,
    isMissingProjectName: projectName === '',
    isMissingAlertThreshold:
      shouldCreateCustomRule && !conditions?.every?.(condition => !!condition.value),
    isMissingMessagingIntegrationChannel:
      shouldCreateRule &&
      notificationProps.actions?.includes(MultipleCheckboxOptions.INTEGRATION) &&
      !notificationProps.channel,
  };
}

function getSubmitTooltipText({
  isMissingProjectName,
  isMissingAlertThreshold,
  isMissingMessagingIntegrationChannel,
  formErrorCount,
}: ReturnType<typeof getMissingValues> & {
  formErrorCount: number;
}): string {
  if (formErrorCount > 1) {
    return t('Please fill out all the required fields');
  }
  if (isMissingProjectName) {
    return t('Please provide a project name');
  }
  if (isMissingAlertThreshold) {
    return t('Please provide an alert threshold');
  }
  if (isMissingMessagingIntegrationChannel) {
    return t('Please provide an integration channel for alert notifications');
  }

  return t('Please select a team');
}

const keyToErrorText: Record<string, string> = {
  actions: t('Notify via integration'),
  conditions: t('Alert conditions'),
  name: t('Alert name'),
  detail: t('Project details'),
};

export function CreateProject() {
  const api = useApi();
  const navigate = useNavigate();
  const [errors, setErrors] = useState();
  const organization = useOrganization();
  const location = useLocation();
  const {createNotificationAction, notificationProps} = useCreateNotificationAction();
  const canUserCreateProject = useCanCreateProject();
  const createProject = useCreateProject();
  const createProjectRules = useCreateProjectRules();
  const {teams} = useTeams();
  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));
  const referrer = decodeScalar(location.query.referrer);
  const projectId = decodeScalar(location.query.project);
  const [createdProject, setCreatedProject] = useLocalStorageState<CreatedProject | null>(
    'created-project-context',
    null
  );

  const createRules = useCallback(
    async ({
      project,
      alertRuleConfig,
    }: {project: Project} & Pick<FormData, 'alertRuleConfig'>) => {
      const ruleIds = [];

      if (alertRuleConfig?.shouldCreateCustomRule) {
        const ruleData = await createProjectRules.mutateAsync({
          projectSlug: project.slug,
          name: project.name,
          conditions: alertRuleConfig?.conditions,
          actions: alertRuleConfig?.actions,
          actionMatch: alertRuleConfig?.actionMatch,
          frequency: alertRuleConfig?.frequency,
        });

        ruleIds.push(ruleData.id);
      }

      const notificationRule = await createNotificationAction({
        shouldCreateRule: alertRuleConfig?.shouldCreateRule,
        name: project.name,
        projectSlug: project.slug,
        conditions: alertRuleConfig?.conditions,
        actionMatch: alertRuleConfig?.actionMatch,
        frequency: alertRuleConfig?.frequency,
      });

      if (notificationRule) {
        ruleIds.push(notificationRule.id);
      }

      return ruleIds;
    },
    [createNotificationAction, createProjectRules]
  );

  const autoFill = useMemo(() => {
    return referrer === 'getting-started' && projectId === createdProject?.id;
  }, [referrer, projectId, createdProject?.id]);

  const defaultTeam = accessTeams?.[0]?.slug;

  const initialData: FormData = useMemo(() => {
    if (autoFill && createdProject) {
      return {
        projectName: createdProject.name ?? '',
        platform: createdProject.platform,
        team: createdProject.team ?? defaultTeam,
        alertRuleConfig: createdProject.alertRule ?? {},
      };
    }

    return {
      projectName: '',
      platform: undefined,
      team: defaultTeam,
      alertRuleConfig: {},
    };
  }, [autoFill, defaultTeam, createdProject]);

  const [formData, setFormData] = useState<FormData>(initialData);

  const canCreateTeam = organization.access.includes('project:admin');
  const isOrgMemberWithNoAccess = accessTeams.length === 0 && !canCreateTeam;

  const missingValues = getMissingValues({
    isOrgMemberWithNoAccess,
    notificationProps,
    projectName: formData.projectName,
    team: formData.team,
    shouldCreateCustomRule: formData.alertRuleConfig?.shouldCreateCustomRule,
    shouldCreateRule: formData.alertRuleConfig?.shouldCreateRule,
    conditions: formData.alertRuleConfig?.conditions,
  });

  const formErrorCount = [
    missingValues.isMissingTeam,
    missingValues.isMissingProjectName,
    missingValues.isMissingAlertThreshold,
    missingValues.isMissingMessagingIntegrationChannel,
  ].filter(value => value).length;

  const canSubmitForm =
    !createProject.isPending && canUserCreateProject && formErrorCount === 0;

  const submitTooltipText = getSubmitTooltipText({
    ...missingValues,
    formErrorCount,
  });

  const updateFormData = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  useEffect(() => {
    (Object.keys(initialData) as Array<keyof typeof initialData>).forEach(key => {
      updateFormData(key, initialData[key]);
    });
  }, [initialData, updateFormData]);

  useRouteAnalyticsEventNames(
    'project_creation_page.viewed',
    'Project Create: Creation page viewed'
  );

  const configurePlatform = useCallback(
    async ({
      selectedFramework,
      platform,
      projectName,
      team,
      alertRuleConfig,
    }: {selectedFramework?: OnboardingSelectedSDK} & Omit<FormData, 'platform'> & {
        platform: OnboardingSelectedSDK;
      }) => {
      const selectedPlatform = selectedFramework ?? platform;

      if (!selectedPlatform) {
        addErrorMessage(t('Please select a platform in Step 1'));
        return;
      }

      let projectToRollback: Project | undefined;

      try {
        const project = await createProject.mutateAsync({
          name: projectName,
          platform: selectedPlatform,
          default_rules: alertRuleConfig?.defaultRules ?? true,
          firstTeamSlug: team,
        });

        projectToRollback = project;

        const ruleIds = await createRules({project, alertRuleConfig});

        trackAnalytics('project_creation_page.created', {
          organization,
          issue_alert: alertRuleConfig?.defaultRules
            ? 'Default'
            : alertRuleConfig?.shouldCreateCustomRule
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

        setCreatedProject({
          id: project.id,
          name: project.name,
          team: project.team?.slug,
          alertRule: {
            shouldCreateRule: alertRuleConfig?.shouldCreateRule ?? false,
            shouldCreateCustomRule: alertRuleConfig?.shouldCreateCustomRule ?? false,
            conditions: alertRuleConfig?.conditions,
            actions: alertRuleConfig?.actions,
            actionMatch: alertRuleConfig?.actionMatch,
            frequency: alertRuleConfig?.frequency,
          },
          platform: selectedPlatform,
        });

        navigate(
          normalizeUrl(
            makeProjectsPathname({
              path: `/${project.slug}/getting-started/`,
              organization,
            })
          )
        );
      } catch (error) {
        setErrors(error.responseJSON);
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

        if (projectToRollback) {
          try {
            // Rolling back the project also deletes its associated alert rules
            // due to the cascading delete constraint.
            await removeProject({
              api,
              orgSlug: organization.slug,
              projectSlug: projectToRollback.slug,
              origin: 'getting_started',
            });
          } catch (err) {
            Sentry.withScope(scope => {
              scope.setExtra('error', err);
              Sentry.captureMessage('Failed to rollback project');
            });
          }
        }
      }
    },
    [createRules, organization, createProject, setCreatedProject, navigate, api]
  );

  const handleProjectCreation = useCallback(
    async (data: FormData) => {
      const selectedPlatform = data.platform;

      if (!isNotPartialPlatform(selectedPlatform)) {
        addErrorMessage(t('Please select a platform in Step 1'));
        return;
      }

      if (
        selectedPlatform.type !== 'language' ||
        !Object.values(SupportedLanguages).includes(
          selectedPlatform.language as SupportedLanguages
        )
      ) {
        configurePlatform({...data, platform: selectedPlatform});
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
              configurePlatform({...data, platform: selectedPlatform, selectedFramework});
            }}
            onSkip={() => configurePlatform({...data, platform: selectedPlatform})}
          />
        ),
        {
          modalCss,
          onClose: () => {
            trackAnalytics(
              'project_creation.select_framework_modal_close_button_clicked',
              {
                platform: selectedPlatform.key,
                organization,
              }
            );
          },
        }
      );
    },
    [configurePlatform, organization]
  );

  const handlePlatformChange = useCallback(
    (value: Platform | null) => {
      if (!value) {
        updateFormData('platform', {
          // By unselecting a platform, we don't want to jump to another category
          category: formData.platform?.category,
        });
        return;
      }

      updateFormData('platform', {
        ...omit(value, 'id'),
        key: value.id,
      });

      const userModifiedName =
        !!formData.projectName && formData.projectName !== formData.platform?.key;
      const newName = userModifiedName ? formData.projectName : value.id;

      updateFormData('projectName', newName);
    },
    [
      updateFormData,
      formData.projectName,
      formData.platform?.key,
      formData.platform?.category,
    ]
  );

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
            platform={formData.platform?.key}
            defaultCategory={formData.platform?.category}
            setPlatform={handlePlatformChange}
            organization={organization}
            showOther
            noAutoFilter
          />
          <StyledListItem>{t('Set your alert frequency')}</StyledListItem>
          <IssueAlertOptions
            alertSetting={
              formData.alertRuleConfig?.shouldCreateCustomRule
                ? RuleAction.CUSTOMIZED_ALERTS
                : formData.alertRuleConfig?.shouldCreateRule
                  ? RuleAction.DEFAULT_ALERT
                  : RuleAction.CREATE_ALERT_LATER
            }
            interval={formData.alertRuleConfig?.conditions?.[0]?.interval}
            threshold={formData.alertRuleConfig?.conditions?.[0]?.value}
            metric={
              formData.alertRuleConfig?.conditions?.[0]?.id.endsWith(
                'EventFrequencyCondition'
              )
                ? MetricValues.ERRORS
                : MetricValues.USERS
            }
            onChange={value => {
              updateFormData('alertRuleConfig', value);
            }}
            notificationProps={notificationProps}
          />
          <StyledListItem>{t('Name your project and assign it a team')}</StyledListItem>
          <FormFieldGroup>
            <div>
              <FormLabel>{t('Project name')}</FormLabel>
              <ProjectNameInputWrap>
                <StyledPlatformIcon
                  platform={formData.platform?.key ?? 'other'}
                  size={20}
                />
                <ProjectNameInput
                  type="text"
                  name="name"
                  placeholder={t('project-name')}
                  autoComplete="off"
                  value={formData.projectName}
                  onChange={e => updateFormData('projectName', slugify(e.target.value))}
                />
              </ProjectNameInputWrap>
            </div>
            {!isOrgMemberWithNoAccess && (
              <div>
                <FormLabel>{t('Team')}</FormLabel>
                <TeamSelectInput>
                  <TeamSelector
                    allowCreate
                    name="team"
                    aria-label={t('Select a Team')}
                    menuPlacement="auto"
                    clearable={false}
                    placeholder={t('Select a Team')}
                    teamFilter={(tm: Team) => tm.access.includes('team:admin')}
                    minMenuHeight={240}
                    value={formData.team}
                    onChange={({value}: {value: string}) => {
                      updateFormData('team', value);
                    }}
                  />
                </TeamSelectInput>
              </div>
            )}
            <div>
              <Tooltip title={submitTooltipText} disabled={formErrorCount === 0}>
                <Button
                  data-test-id="create-project"
                  priority="primary"
                  disabled={!canSubmitForm}
                  onClick={() => handleProjectCreation(formData)}
                >
                  {t('Create Project')}
                </Button>
              </Tooltip>
            </div>
          </FormFieldGroup>
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

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const FormFieldGroup = styled('div')`
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
