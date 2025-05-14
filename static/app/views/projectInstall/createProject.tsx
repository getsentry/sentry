import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import startCase from 'lodash/startCase';
import {Observer} from 'mobx-react';
import {PlatformIcon} from 'platformicons';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Tooltip} from 'sentry/components/core/tooltip';
import Form from 'sentry/components/forms/form';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import PlatformPicker from 'sentry/components/platformPicker';
import TeamSelector from 'sentry/components/teamSelector';
import categoryList from 'sentry/data/platformPickerCategories';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar} from 'sentry/utils/queryString';
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
import type {RequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import IssueAlertOptions, {
  MetricValues,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';
import {GettingStartedWithProjectContext} from 'sentry/views/projects/gettingStartedWithProjectContext';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type FormData = {
  alertRuleConfig: RequestDataFragment | undefined;
  platform: OnboardingSelectedSDK | undefined;
  projectName: string;
  team: string | undefined;
};

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
  const [model] = useState(() => new FormModel());

  const [errors, setErrors] = useState(false);
  const organization = useOrganization();
  const location = useLocation();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);
  const {createNotificationAction, notificationProps} = useCreateNotificationAction();
  const {teams} = useTeams();
  const accessTeams = teams.filter((team: Team) => team.access.includes('team:admin'));
  const referrer = decodeScalar(location.query.referrer);
  const projectId = decodeScalar(location.query.project);

  const createRules = useCallback(
    async ({
      project,
      alertRuleConfig,
    }: {project: Project} & Pick<FormData, 'alertRuleConfig'>) => {
      const ruleIds = [];

      if (alertRuleConfig?.shouldCreateCustomRule) {
        const ruleData = await api.requestPromise(
          `/projects/${organization.slug}/${project.slug}/rules/`,
          {
            method: 'POST',
            data: {
              name: project.name,
              conditions: alertRuleConfig?.conditions,
              actions: alertRuleConfig?.actions,
              actionMatch: alertRuleConfig?.actionMatch,
              frequency: alertRuleConfig?.frequency,
            },
          }
        );

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
    [organization, api, createNotificationAction]
  );

  const createProject = useCreateProject();

  const autoFill = useMemo(() => {
    return (
      referrer === 'getting-started' &&
      projectId === gettingStartedWithProjectContext.project?.id
    );
  }, [referrer, projectId, gettingStartedWithProjectContext.project?.id]);

  const defaultTeam = accessTeams?.[0]?.slug;

  const initialData = useMemo(() => {
    if (autoFill) {
      const platform = gettingStartedWithProjectContext.project?.platform;
      const platformCategory =
        (platform
          ? categoryList.find(category => {
              return category.platforms?.has(platform?.key);
            })?.id
          : undefined) ?? 'all';
      return {
        projectName: gettingStartedWithProjectContext.project?.name ?? '',
        platform: {
          ...platform,
          category: platformCategory,
        },
        team: gettingStartedWithProjectContext.project?.teamSlug ?? defaultTeam,
        alertRuleConfig: gettingStartedWithProjectContext.project?.alertRule ?? {},
      };
    }
    return {
      projectName: '',
      platform: undefined,
      team: defaultTeam,
      alertRuleConfig: {},
    };
  }, [autoFill, gettingStartedWithProjectContext.project, defaultTeam]);

  useEffect(() => {
    (Object.keys(initialData) as Array<keyof typeof initialData>).forEach(key => {
      model.setValue(key, initialData[key] as FieldValue);
    });
  }, [initialData, model]);

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
    }: {selectedFramework?: OnboardingSelectedSDK} & FormData) => {
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

        gettingStartedWithProjectContext.setProject({
          id: project.id,
          name: project.name,
          teamSlug: project.team?.slug,
          alertRule: {
            shouldCreateRule: alertRuleConfig?.shouldCreateRule ?? false,
            shouldCreateCustomRule: alertRuleConfig?.shouldCreateCustomRule ?? false,
            conditions: alertRuleConfig?.conditions,
          },
          platform: selectedPlatform,
        });

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

        browserHistory.push(
          normalizeUrl(
            makeProjectsPathname({
              path: `/${project.slug}/getting-started/`,
              organization,
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
    [createRules, organization, createProject, gettingStartedWithProjectContext]
  );

  const handleProjectCreation = useCallback(
    async (data: FormData) => {
      const selectedPlatform = data.platform;

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
        configurePlatform(data);
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
              configurePlatform({...data, selectedFramework});
            }}
            onSkip={() => configurePlatform(data)}
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

  const canUserCreateProject = useCanCreateProject();

  const canCreateTeam = organization.access.includes('project:admin');
  const isOrgMemberWithNoAccess = accessTeams.length === 0 && !canCreateTeam;

  return (
    <Access access={canUserCreateProject ? ['project:read'] : ['project:admin']}>
      <div data-test-id="onboarding-info" key={projectId}>
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
          <Observer>
            {() => {
              const platform: OnboardingSelectedSDK | undefined =
                model.getValue('platform');
              const projectName: string = model.getValue('projectName');

              return (
                <Fragment>
                  <StyledListItem>{t('Choose your platform')}</StyledListItem>
                  <PlatformPicker
                    platform={platform?.key}
                    defaultCategory={platform?.category}
                    setPlatform={value => {
                      if (!value) {
                        model.setValue('platform', undefined);
                        return;
                      }
                      const userModifiedName =
                        !!projectName && projectName !== platform?.key;

                      const newName = userModifiedName ? projectName : value.id;

                      model.setValue('platform', {
                        ...omit(value, 'id'),
                        key: value.id,
                      });
                      model.setValue('projectName', newName);
                    }}
                    organization={organization}
                    showOther
                    noAutoFilter
                  />
                </Fragment>
              );
            }}
          </Observer>
          <Form
            hideFooter
            model={model}
            onSubmit={(data, _onSuccess, _onError, event) => {
              // Prevent the page from reloading
              event.preventDefault();
              handleProjectCreation(data as FormData);
            }}
            initialData={initialData}
          >
            <Observer>
              {() => {
                const platform: OnboardingSelectedSDK | undefined =
                  model.getValue('platform');
                const projectName: string = model.getValue('projectName');
                const team: string | undefined = model.getValue('team');
                const alertRuleConfig: RequestDataFragment | undefined =
                  model.getValue('alertRuleConfig');

                const missingValues = getMissingValues({
                  isOrgMemberWithNoAccess,
                  notificationProps,
                  projectName,
                  team,
                  shouldCreateCustomRule: alertRuleConfig?.shouldCreateCustomRule,
                  shouldCreateRule: alertRuleConfig?.shouldCreateRule,
                  conditions: alertRuleConfig?.conditions,
                });

                const formErrorCount = [
                  missingValues.isMissingTeam,
                  missingValues.isMissingProjectName,
                  missingValues.isMissingAlertThreshold,
                  missingValues.isMissingMessagingIntegrationChannel,
                ].filter(value => value).length;

                const canSubmitForm =
                  !createProject.isPending &&
                  canUserCreateProject &&
                  formErrorCount === 0;

                const submitTooltipText = getSubmitTooltipText({
                  ...missingValues,
                  formErrorCount,
                });

                return (
                  <Fragment>
                    <StyledListItem>{t('Set your alert frequency')}</StyledListItem>
                    <IssueAlertOptions
                      alertSetting={
                        alertRuleConfig?.shouldCreateCustomRule
                          ? RuleAction.CUSTOMIZED_ALERTS
                          : alertRuleConfig?.shouldCreateRule
                            ? RuleAction.DEFAULT_ALERT
                            : RuleAction.CREATE_ALERT_LATER
                      }
                      interval={alertRuleConfig?.conditions?.[0]?.interval}
                      threshold={alertRuleConfig?.conditions?.[0]?.value}
                      metric={
                        alertRuleConfig?.conditions?.[0]?.id.endsWith(
                          'EventFrequencyCondition'
                        )
                          ? MetricValues.ERRORS
                          : MetricValues.USERS
                      }
                      onChange={value => {
                        model.setValue('alertRuleConfig', value);
                      }}
                      notificationProps={notificationProps}
                    />
                    <StyledListItem>
                      {t('Name your project and assign it a team')}
                    </StyledListItem>
                    <FormFieldGroup>
                      <div>
                        <FormLabel>{t('Project name')}</FormLabel>
                        <ProjectNameInputWrap>
                          <StyledPlatformIcon
                            platform={platform?.key ?? 'other'}
                            size={20}
                          />
                          <ProjectNameInput
                            type="text"
                            name="name"
                            placeholder={t('project-name')}
                            autoComplete="off"
                            value={model.getValue('projectName')}
                            onChange={e =>
                              model.setValue('projectName', slugify(e.target.value))
                            }
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
                              value={model.getValue('team')}
                              onChange={({value}: {value: string}) => {
                                model.setValue('team', value);
                              }}
                            />
                          </TeamSelectInput>
                        </div>
                      )}
                      <div>
                        <Tooltip
                          title={submitTooltipText}
                          disabled={formErrorCount === 0}
                        >
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
                    </FormFieldGroup>
                  </Fragment>
                );
              }}
            </Observer>
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
          </Form>
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
