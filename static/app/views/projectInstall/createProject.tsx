import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import {PlatformIcon} from 'platformicons';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConsoleModal, openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProjectCreationErrorAlert} from 'sentry/components/onboarding/projectCreationErrorAlert';
import {useCreateProjectAndRules} from 'sentry/components/onboarding/useCreateProjectAndRules';
import PlatformPicker, {type Platform} from 'sentry/components/platformPicker';
import {TeamSelector} from 'sentry/components/teamSelector';
import {categoryList} from 'sentry/data/platformPickerCategories';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDisabledGamingPlatform} from 'sentry/utils/platform';
import {decodeScalar} from 'sentry/utils/queryString';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {
  MultipleCheckboxOptions,
  useCreateNotificationAction,
  type IntegrationChannel,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {
  AlertRuleOptions,
  RequestDataFragment,
} from 'sentry/views/projectInstall/issueAlertOptions';
import IssueAlertOptions, {
  getRequestDataFragment,
} from 'sentry/views/projectInstall/issueAlertOptions';
import {useValidateChannel} from 'sentry/views/projectInstall/useValidateChannel';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type FormData = {
  projectName: string;
  alertRule?: Partial<AlertRuleOptions>;
  platform?: OnboardingSelectedSDK;
  team?: string;
};

type CreatedProject = Pick<Project, 'name' | 'id'> & {
  platform: OnboardingSelectedSDK;
  alertRule?: Partial<AlertRuleOptions>;
  notificationRule?: IssueAlertRule;
  team?: string;
};

function getMissingValues({
  team,
  projectName,
  conditions,
  notificationProps,
  shouldCreateRule,
  shouldCreateCustomRule,
  isOrgMemberWithNoAccess,
  platform,
}: {
  isOrgMemberWithNoAccess: boolean;
  notificationProps: {
    actions?: string[];
    channel?: IntegrationChannel;
  };
  projectName: string;
  team: string | undefined;
  platform?: OnboardingSelectedSDK;
} & Partial<
  Pick<RequestDataFragment, 'conditions' | 'shouldCreateCustomRule' | 'shouldCreateRule'>
>) {
  return {
    isMissingTeam: !isOrgMemberWithNoAccess && !team,
    isMissingProjectName: projectName === '',
    isMissingAlertThreshold:
      shouldCreateCustomRule &&
      (!conditions ||
        conditions.length === 0 ||
        !conditions.every(condition => !!condition.value)),
    isMissingMessagingIntegrationChannel:
      shouldCreateRule &&
      notificationProps.actions?.includes(MultipleCheckboxOptions.INTEGRATION) &&
      !notificationProps.channel,
    isMissingPlatform: !platform,
  };
}

function getSubmitTooltipText({
  isMissingProjectName,
  isMissingAlertThreshold,
  isMissingMessagingIntegrationChannel,
  isMissingPlatform,
  formErrorCount,
}: ReturnType<typeof getMissingValues> & {
  formErrorCount: number;
}): string {
  if (formErrorCount > 1) {
    return t('Please fill out all the required fields');
  }
  if (isMissingProjectName) {
    return t('Please provide a project slug');
  }
  if (isMissingAlertThreshold) {
    return t('Please provide an alert threshold');
  }
  if (isMissingMessagingIntegrationChannel) {
    return t('Please provide an integration channel for alert notifications');
  }
  if (isMissingPlatform) {
    return t('Please select a platform');
  }

  return t('Please select a team');
}

export function CreateProject() {
  const globalModal = useGlobalModal();
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();
  const canUserCreateProject = useCanCreateProject();
  const createProjectAndRules = useCreateProjectAndRules();

  const {teams} = useTeams();
  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));
  const referrer = decodeScalar(location.query.referrer);
  const projectId = decodeScalar(location.query.project);
  const [createdProject, setCreatedProject] = useLocalStorageState<CreatedProject | null>(
    'created-project-context',
    null
  );
  const autoFill = useMemo(() => {
    return referrer === 'getting-started' && projectId === createdProject?.id;
  }, [referrer, projectId, createdProject?.id]);

  const createNotificationActionParam = useMemo(() => {
    return autoFill && createdProject?.notificationRule?.actions
      ? {actions: createdProject.notificationRule.actions}
      : undefined;
  }, [autoFill, createdProject?.notificationRule?.actions]);

  const {createNotificationAction, notificationProps} = useCreateNotificationAction(
    createNotificationActionParam
  );

  const validateChannel = useValidateChannel({
    channel: notificationProps.channel,
    integrationId: notificationProps.integration?.id,
    enabled: false,
  });

  const defaultTeam = accessTeams?.[0]?.slug;

  const initialData: FormData = useMemo(() => {
    if (autoFill && createdProject) {
      return {
        projectName: createdProject.name ?? '',
        platform: createdProject.platform,
        team: createdProject.team ?? defaultTeam,
        alertRule: createdProject.alertRule,
      };
    }

    return {
      projectName: '',
      platform: undefined,
      team: defaultTeam,
    };
  }, [autoFill, defaultTeam, createdProject]);

  const [formData, setFormData] = useState<FormData>(initialData);
  const pickerKeyRef = useRef<'create-project' | 'auto-fill'>('create-project');

  const canCreateTeam = organization.access.includes('project:admin');
  const isOrgMemberWithNoAccess = accessTeams.length === 0 && !canCreateTeam;

  const alertRuleConfig = useMemo(
    () => getRequestDataFragment(formData.alertRule),
    [formData.alertRule]
  );

  const missingValues = getMissingValues({
    isOrgMemberWithNoAccess,
    notificationProps,
    projectName: formData.projectName,
    team: formData.team,
    shouldCreateCustomRule: alertRuleConfig.shouldCreateCustomRule,
    shouldCreateRule: alertRuleConfig.shouldCreateRule,
    conditions: alertRuleConfig.conditions,
    platform: formData.platform,
  });

  const isNotifyingViaIntegration =
    alertRuleConfig.shouldCreateRule &&
    notificationProps.actions?.includes(MultipleCheckboxOptions.INTEGRATION);

  const formErrorCount = [
    missingValues.isMissingPlatform,
    missingValues.isMissingTeam,
    missingValues.isMissingProjectName,
    missingValues.isMissingAlertThreshold,
    missingValues.isMissingMessagingIntegrationChannel,
    isNotifyingViaIntegration && validateChannel.error,
  ].filter(value => value).length;

  const submitTooltipText =
    isNotifyingViaIntegration && validateChannel.error
      ? validateChannel.error
      : getSubmitTooltipText({
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
      alertRule,
    }: {selectedFramework?: OnboardingSelectedSDK} & Omit<FormData, 'platform'> & {
        platform: OnboardingSelectedSDK;
      }) => {
      const selectedPlatform = selectedFramework ?? platform;

      try {
        const {project, notificationRule, ruleIds} =
          await createProjectAndRules.mutateAsync({
            projectName,
            platform: selectedPlatform,
            team,
            alertRuleConfig,
            createNotificationAction,
          });

        trackAnalytics('project_creation_page.created', {
          organization,
          issue_alert: alertRuleConfig.shouldCreateCustomRule
            ? 'Custom'
            : alertRuleConfig.shouldCreateRule === false
              ? 'No Rule'
              : 'Default',
          project_id: project.id,
          platform: selectedPlatform.key,
          rule_ids: ruleIds,
          notification_rule_created: !!notificationRule,
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
          platform: selectedPlatform,
          alertRule,
          notificationRule,
        });

        navigate(
          normalizeUrl(
            makeProjectsPathname({
              path: `/${project.slug}/getting-started/`,
              organization,
            })
          )
        );
      } catch (error: any) {
        addErrorMessage(t('Failed to create project %s', `${projectName}`));

        if (error.status === 403) {
          Sentry.withScope(scope => {
            scope.setExtra('err', error);
            scope.setContext('permission_context', {
              org_slug: organization.slug,
              team,
              org_access: organization.access,
              org_features: organization.features,
              org_allow_member_project_creation: organization.allowMemberProjectCreation,
              user_team_access: team
                ? accessTeams.find(teamItem => teamItem.slug === team)?.access
                : null,
              available_teams_count: accessTeams.length,
            });
            Sentry.captureMessage('Project creation permission denied');
          });
        } else if (error.status !== 409) {
          Sentry.withScope(scope => {
            scope.setExtra('err', error);
            Sentry.captureMessage('Project creation failed');
          });
        }
      }
    },
    [
      organization,
      setCreatedProject,
      navigate,
      createProjectAndRules,
      createNotificationAction,
      alertRuleConfig,
      accessTeams,
    ]
  );

  const handleProjectCreation = useCallback(
    async ({platform, ...data}: FormData) => {
      // At this point, platform should be defined
      // otherwise the submit button would be disabled.
      if (!platform) {
        return;
      }

      if (
        platform.type !== 'language' ||
        !Object.values(SupportedLanguages).includes(
          platform.language as SupportedLanguages
        )
      ) {
        configurePlatform({...data, platform});
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
            selectedPlatform={platform}
            onConfigure={selectedFramework => {
              configurePlatform({...data, platform, selectedFramework});
            }}
            onSkip={() => configurePlatform({...data, platform})}
          />
        ),
        {
          modalCss,
          onClose: () => {
            trackAnalytics(
              'project_creation.select_framework_modal_close_button_clicked',
              {
                platform: platform.key,
                organization,
              }
            );
          },
        }
      );
    },
    [configurePlatform, organization]
  );

  const debounceHandleProjectCreation = useMemo(
    () => debounce(handleProjectCreation, 2000, {leading: true, trailing: false}),
    [handleProjectCreation]
  );

  const handlePlatformChange = useCallback(
    (value: Platform | null) => {
      if (!value) {
        updateFormData('platform', undefined);
        return;
      }

      if (
        isDisabledGamingPlatform({
          platform: value,
          enabledConsolePlatforms: organization.enabledConsolePlatforms,
        })
      ) {
        openConsoleModal({
          organization,
          selectedPlatform: {
            key: value.id,
            name: value.name,
            type: value.type,
            language: value.language,
            category: value.category,
            link: value.link,
          },
          origin: 'project-creation',
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
    [updateFormData, formData.projectName, formData.platform?.key, organization]
  );

  const platform = formData.platform?.key;
  const defaultCategory = platform
    ? categoryList.find(({platforms}) => platforms.has(platform))?.id
    : 'popular';

  // Workaround to force PlatformPicker to re-render when users go back in the flow and fields should be pre-filled.
  // Without this, the selected platform might not be visible depending on the active tab.
  if (autoFill && platform && pickerKeyRef.current === 'create-project') {
    pickerKeyRef.current = 'auto-fill';
  }

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
            key={pickerKeyRef.current}
            platform={platform}
            defaultCategory={defaultCategory}
            setPlatform={handlePlatformChange}
            organization={organization}
            showOther
            noAutoFilter
          />
          <StyledListItem>{t('Set your alert frequency')}</StyledListItem>
          <IssueAlertOptions
            alertSetting={formData.alertRule?.alertSetting}
            interval={formData.alertRule?.interval}
            metric={formData.alertRule?.metric}
            threshold={formData.alertRule?.threshold}
            notificationProps={notificationProps}
            onFieldChange={(field, value) => {
              updateFormData('alertRule', {
                ...formData.alertRule,
                [field]: value,
              });
            }}
          />
          <StyledListItem>
            {isOrgMemberWithNoAccess
              ? t('Name your project')
              : t('Name your project and assign it a team')}
          </StyledListItem>
          <FormFieldGroup>
            <div>
              <FormLabel>{t('Project slug')}</FormLabel>
              <ProjectNameInputWrap>
                <StyledPlatformIcon
                  platform={formData.platform?.key ?? 'other'}
                  size={20}
                />
                <ProjectNameInput
                  type="text"
                  name="name"
                  placeholder={t('project-slug')}
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
              <Tooltip
                title={
                  canUserCreateProject
                    ? isNotifyingViaIntegration && validateChannel.isFetching
                      ? t('Validating integration channel\u2026')
                      : submitTooltipText
                    : t('You do not have permission to create projects')
                }
                disabled={
                  formErrorCount === 0 &&
                  canUserCreateProject &&
                  !(isNotifyingViaIntegration && validateChannel.isFetching)
                }
              >
                <Button
                  data-test-id="create-project"
                  priority="primary"
                  disabled={!(canUserCreateProject && formErrorCount === 0)}
                  busy={
                    createProjectAndRules.isPending ||
                    (isNotifyingViaIntegration && validateChannel.isFetching)
                  }
                  onClick={() => debounceHandleProjectCreation(formData)}
                >
                  {t('Create Project')}
                </Button>
              </Tooltip>
            </div>
          </FormFieldGroup>
          {!globalModal.visible && (
            <ProjectCreationErrorAlert error={createProjectAndRules.error} />
          )}
        </List>
      </div>
    </Access>
  );
}

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.xl};
`;

const FormFieldGroup = styled('div')`
  display: grid;
  grid-template-columns: 300px minmax(250px, max-content) max-content;
  gap: ${space(2)};
  align-items: end;
  padding: ${space(3)} 0;
  background: ${p => p.theme.tokens.background.primary};
`;

const FormLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1)};
`;

const ProjectNameInputWrap = styled('div')`
  position: relative;
`;

const ProjectNameInput = styled(Input)`
  padding-left: calc(${p => p.theme.form.md.paddingLeft}px * 1.5 + 20px);
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: 50%;
  left: ${p => p.theme.form.md.paddingLeft}px;
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
