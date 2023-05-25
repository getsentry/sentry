import {Fragment, useCallback, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import omit from 'lodash/omit';
import {PlatformIcon} from 'platformicons';

import {openCreateTeamModal, openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {SUPPORTED_LANGUAGES} from 'sentry/components/onboarding/frameworkSuggestionModal';
import PlatformPicker, {Platform} from 'sentry/components/platformPicker';
import {useProjectCreationAccess} from 'sentry/components/projects/useProjectCreationAccess';
import TeamSelector from 'sentry/components/teamSelector';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedSDK, Team} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import IssueAlertOptions from 'sentry/views/projectInstall/issueAlertOptions';

type IssueAlertFragment = Parameters<
  React.ComponentProps<typeof IssueAlertOptions>['onChange']
>[0];

function CreateProject() {
  const api = useApi();
  const organization = useOrganization();

  const accessTeams = useTeams().teams.filter((team: Team) => team.hasAccess);

  useRouteAnalyticsEventNames(
    'project_creation_page.viewed',
    'Project Create: Creation page viewed'
  );

  const [projectName, setProjectName] = useState('');
  const [platform, setPlatform] = useState<OnboardingSelectedSDK | undefined>(undefined);
  const [team, setTeam] = useState(accessTeams?.[0]?.slug);

  const [error, setError] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  const [alertRuleConfig, setAlertRuleConfig] = useState<IssueAlertFragment | undefined>(
    undefined
  );

  const frameworkSelectionEnabled = !!organization?.features.includes(
    'onboarding-sdk-selection'
  );

  const createProject = useCallback(
    async (selectedFramework?: OnboardingSelectedSDK) => {
      const {slug} = organization;
      const {
        shouldCreateCustomRule,
        name,
        conditions,
        actions,
        actionMatch,
        frequency,
        defaultRules,
      } = alertRuleConfig || {};

      const selectedPlatform = selectedFramework?.key ?? platform?.key;

      if (!selectedPlatform) {
        return;
      }

      setInFlight(true);

      try {
        const projectData = await api.requestPromise(`/teams/${slug}/${team}/projects/`, {
          method: 'POST',
          data: {
            name: projectName,
            platform: selectedPlatform,
            default_rules: defaultRules ?? true,
          },
        });

        let ruleId: string | undefined;
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
          ruleId = ruleData.id;
        }
        trackAnalytics('project_creation_page.created', {
          organization,
          issue_alert: defaultRules
            ? 'Default'
            : shouldCreateCustomRule
            ? 'Custom'
            : 'No Rule',
          project_id: projectData.id,
          rule_id: ruleId || '',
        });

        ProjectsStore.onCreateSuccess(projectData, organization.slug);

        browserHistory.push(
          normalizeUrl(
            `/${organization.slug}/${projectData.slug}/getting-started/${selectedPlatform}/`
          )
        );
      } catch (err) {
        setInFlight(false);
        setError(err.responseJSON.detail);

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
    [api, alertRuleConfig, organization, platform, projectName, team]
  );

  const handleProjectCreation = useCallback(async () => {
    const selectedPlatform = platform;

    if (!selectedPlatform) {
      return;
    }

    if (
      selectedPlatform.type !== 'language' ||
      !Object.values(SUPPORTED_LANGUAGES).includes(
        selectedPlatform.language as SUPPORTED_LANGUAGES
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

  const {shouldCreateCustomRule, conditions} = alertRuleConfig || {};
  const {canCreateProject} = useProjectCreationAccess(organization);
  const canSubmitForm =
    !inFlight &&
    team &&
    canCreateProject &&
    projectName !== '' &&
    (!shouldCreateCustomRule || conditions?.every?.(condition => condition.value));

  const createProjectForm = (
    <Fragment>
      <Layout.Title withMargins>
        {t('3. Name your project and assign it a team')}
      </Layout.Title>
      <CreateProjectForm
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          // Prevent the page from reloading
          event.preventDefault();
          frameworkSelectionEnabled ? handleProjectCreation() : createProject();
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
        <div>
          <FormLabel>{t('Team')}</FormLabel>
          <TeamSelectInput>
            <TeamSelector
              name="select-team"
              aria-label={t('Select a Team')}
              menuPlacement="auto"
              clearable={false}
              value={team}
              placeholder={t('Select a Team')}
              onChange={choice => setTeam(choice.value)}
              teamFilter={(filterTeam: Team) => filterTeam.hasAccess}
            />
            <Button
              borderless
              data-test-id="create-team"
              icon={<IconAdd isCircled />}
              onClick={() =>
                openCreateTeamModal({
                  organization,
                  onClose: ({slug}) => setTeam(slug),
                })
              }
              title={t('Create a team')}
              aria-label={t('Create a team')}
            />
          </TeamSelectInput>
        </div>
        <div>
          <Button
            type="submit"
            data-test-id="create-project"
            priority="primary"
            disabled={!canSubmitForm}
          >
            {t('Create Project')}
          </Button>
        </div>
      </CreateProjectForm>
    </Fragment>
  );

  return (
    <Fragment>
      {error && <Alert type="error">{error}</Alert>}
      <div data-test-id="onboarding-info">
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
        <Layout.Title withMargins>{t('1. Choose your platform')}</Layout.Title>
        <PlatformPicker
          platform={platform?.key}
          defaultCategory={platform?.category}
          setPlatform={handlePlatformChange}
          organization={organization}
          showOther
        />
        <IssueAlertOptions onChange={updatedData => setAlertRuleConfig(updatedData)} />
        {createProjectForm}
      </div>
    </Fragment>
  );
}

export {CreateProject};

const CreateProjectForm = styled('form')`
  display: grid;
  grid-template-columns: 300px minmax(250px, max-content) max-content;
  gap: ${space(2)};
  align-items: end;
  padding: ${space(3)} 0;
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.1);
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
