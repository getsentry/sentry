import {Fragment, useCallback, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {PlatformIcon} from 'platformicons';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PlatformPicker from 'sentry/components/platformPicker';
import TeamSelector from 'sentry/components/teamSelector';
import categoryList from 'sentry/data/platformCategories';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import {Team} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getPlatformName from 'sentry/utils/getPlatformName';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import slugify from 'sentry/utils/slugify';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import IssueAlertOptions from 'sentry/views/projectInstall/issueAlertOptions';

const getCategoryName = (category?: string) =>
  categoryList.find(({id}) => id === category)?.id;

type PlatformName = React.ComponentProps<typeof PlatformIcon>['platform'];
type IssueAlertFragment = Parameters<
  React.ComponentProps<typeof IssueAlertOptions>['onChange']
>[0];

function CreateProject() {
  const api = useApi();
  const organization = useOrganization();

  const location = useLocation();
  const {query} = location;

  const accessTeams = useTeams().teams.filter((team: Team) => team.hasAccess);

  useRouteAnalyticsEventNames(
    'project_creation_page.viewed',
    'Project Create: Creation page viewed'
  );

  const platformQuery = Array.isArray(query.platform)
    ? query.platform[0]
    : query.platform ?? null;

  const platformName = getPlatformName(platformQuery);

  const defaultCategory = getCategoryName(
    Array.isArray(query.category) ? query.category[0] : query.category ?? undefined
  );

  const [projectName, setProjectName] = useState(platformName ?? '');
  const [platform, setPlatform] = useState(platformName ? platformQuery : '');
  const [team, setTeam] = useState(query.team || accessTeams?.[0]?.slug);

  const [error, setError] = useState(false);
  const [inFlight, setInFlight] = useState(false);

  const [alertRuleConfig, setAlertRuleConfig] = useState<IssueAlertFragment | undefined>(
    undefined
  );

  const createProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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

      setInFlight(true);

      try {
        const projectData = await api.requestPromise(`/teams/${slug}/${team}/projects/`, {
          method: 'POST',
          data: {
            name: projectName,
            platform,
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

        const platformKey = platform || 'other';

        browserHistory.push(
          normalizeUrl(
            `/${organization.slug}/${projectData.slug}/getting-started/${platformKey}/`
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

  function handlePlatformChange(platformKey: PlatformName | null) {
    if (!platformKey) {
      setPlatform(null);
      setProjectName('');
      return;
    }

    const userModifiedName = projectName && projectName !== platform;
    const newName = userModifiedName ? projectName : platformKey;

    setPlatform(platformKey);
    setProjectName(newName);
  }

  const {shouldCreateCustomRule, conditions} = alertRuleConfig || {};

  const canSubmitForm =
    !inFlight &&
    team &&
    projectName !== '' &&
    (!shouldCreateCustomRule || conditions?.every?.(condition => condition.value));

  const createProjectForm = (
    <Fragment>
      <Layout.Title withMargins>
        {t('3. Name your project and assign it a team')}
      </Layout.Title>
      <CreateProjectForm onSubmit={createProject}>
        <div>
          <FormLabel>{t('Project name')}</FormLabel>
          <ProjectNameInputWrap>
            <StyledPlatformIcon platform={platform ?? ''} size={20} />
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
          platform={platform}
          defaultCategory={defaultCategory}
          setPlatform={selectedPlatform =>
            handlePlatformChange(selectedPlatform?.id ?? null)
          }
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
