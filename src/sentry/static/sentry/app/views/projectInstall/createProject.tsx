import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import PlatformIcon from 'platformicons';

import {Organization, Project, Team} from 'app/types';
import {inputStyles} from 'app/styles/input';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import PlatformPicker from 'app/components/platformPicker';
import ProjectActions from 'app/actions/projectActions';
import SelectControl from 'app/components/forms/selectControl';
import Tooltip from 'app/components/tooltip';
import getPlatformName from 'app/utils/getPlatformName';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';
import IssueAlertOptions from 'app/views/projectInstall/issueAlertOptions';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import slugify from 'app/utils/slugify';
import {IconAdd} from 'app/icons';

type RuleEventData = {
  eventKey: string;
  eventName: string;
  organization_id: string;
  project_id: string;
  rule_type: string;
  custom_rule_id?: string;
};

type Props = {
  api: any;
  organization: Organization;
  teams: Team[];
};

type PlatformName = React.ComponentProps<typeof PlatformIcon>['platform'];
type IssueAlertFragment = Parameters<
  React.ComponentProps<typeof IssueAlertOptions>['onChange']
>[0];

type State = {
  error: boolean;
  projectName: string;
  team: string;
  platform: PlatformName;
  inFlight: boolean;
  dataFragment: IssueAlertFragment | undefined;
};

class CreateProject extends React.Component<Props, State> {
  static contextTypes = {
    location: PropTypes.object,
  };

  constructor(props, ...args) {
    super(props, ...args);

    const {query} = this.context.location;
    const {teams} = props.organization;
    const accessTeams = teams.filter((team: Team) => team.hasAccess);

    const team = query.team || (accessTeams.length && accessTeams[0].slug);
    const platform = getPlatformName(query.platform) ? query.platform : '';

    this.state = {
      error: false,
      projectName: getPlatformName(platform) || '',
      team,
      platform,
      inFlight: false,
      dataFragment: undefined,
    };
  }

  renderProjectForm() {
    const {organization} = this.props;
    const {projectName, platform, team} = this.state;

    const teams = this.props.teams.filter(filterTeam => filterTeam.hasAccess);

    const createProjectForm = (
      <CreateProjectForm onSubmit={this.createProject}>
        <div>
          <FormLabel>{t('Project name')}</FormLabel>
          <ProjectNameInput theme={theme}>
            <StyledPlatformIcon platform={platform} />
            <input
              type="text"
              name="name"
              placeholder={t('Project name')}
              autoComplete="off"
              value={projectName}
              onChange={e => this.setState({projectName: slugify(e.target.value)})}
            />
          </ProjectNameInput>
        </div>
        <div>
          <FormLabel>{t('Team')}</FormLabel>
          <TeamSelectInput>
            <SelectControl
              deprecatedSelectControl
              name="select-team"
              clearable={false}
              value={team}
              placeholder={t('Select a Team')}
              onChange={choice => this.setState({team: choice.value})}
              options={teams.map(({slug}) => ({
                label: `#${slug}`,
                value: slug,
              }))}
            />
            <Tooltip title={t('Create a team')}>
              <Button
                borderless
                data-test-id="create-team"
                type="button"
                icon={<IconAdd isCircled />}
                onClick={() =>
                  openCreateTeamModal({
                    organization,
                    onClose: ({slug}) => this.setState({team: slug}),
                  })
                }
              />
            </Tooltip>
          </TeamSelectInput>
        </div>
        <div>
          <Button
            data-test-id="create-project"
            priority="primary"
            disabled={!this.canSubmitForm}
          >
            {t('Create Project')}
          </Button>
        </div>
      </CreateProjectForm>
    );

    return (
      <React.Fragment>
        <PageHeading withMargins>{t('Give your project a name')}</PageHeading>
        {createProjectForm}
      </React.Fragment>
    );
  }

  get canSubmitForm() {
    const {projectName, team, inFlight} = this.state;
    const {shouldCreateCustomRule, conditions} = this.state.dataFragment || {};

    return (
      !inFlight &&
      team &&
      projectName !== '' &&
      (!shouldCreateCustomRule || conditions?.every?.(condition => condition.value))
    );
  }

  createProject = async e => {
    e.preventDefault();
    const {organization, api} = this.props;
    const {projectName, platform, team, dataFragment} = this.state;
    const {slug} = organization;
    const {
      shouldCreateCustomRule,
      name,
      conditions,
      actions,
      actionMatch,
      frequency,
      defaultRules,
    } = dataFragment || {};

    this.setState({inFlight: true});

    if (!projectName) {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('No project name');
      });
    }

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
      this.trackIssueAlertOptionSelectedEvent(
        projectData,
        defaultRules,
        shouldCreateCustomRule,
        ruleId
      );

      ProjectActions.createSuccess(projectData);
      const platformKey = platform || 'other';
      const nextUrl = `/${organization.slug}/${projectData.slug}/getting-started/${platformKey}/`;
      browserHistory.push(nextUrl);
    } catch (err) {
      this.setState({
        inFlight: false,
        error: err.responseJSON.detail,
      });

      // Only log this if the error is something other than:
      // * The user not having access to create a project, or,
      // * A project with that slug already exists
      if (err.status !== 403 && err.status !== 409) {
        Sentry.withScope(scope => {
          scope.setExtra('err', err);
          scope.setExtra('props', this.props);
          scope.setExtra('state', this.state);
          Sentry.captureMessage('Project creation failed');
        });
      }
    }
  };

  trackIssueAlertOptionSelectedEvent(
    projectData: Project,
    isDefaultRules: boolean | undefined,
    shouldCreateCustomRule: boolean | undefined,
    ruleId: string | undefined
  ) {
    const {organization} = this.props;

    let data: RuleEventData = {
      eventKey: 'new_project.alert_rule_selected',
      eventName: 'New Project Alert Rule Selected',
      organization_id: organization.id,
      project_id: projectData.id,
      rule_type: isDefaultRules
        ? 'Default'
        : shouldCreateCustomRule
        ? 'Custom'
        : 'No Rule',
    };

    if (ruleId !== undefined) {
      data = {...data, custom_rule_id: ruleId};
    }

    trackAnalyticsEvent(data);
  }

  setPlatform = (platformId: PlatformName) =>
    this.setState(({projectName, platform}: State) => ({
      platform: platformId,
      projectName:
        !projectName || (platform && getPlatformName(platform) === projectName)
          ? getPlatformName(platformId) || ''
          : projectName,
    }));

  render() {
    const {platform, error} = this.state;

    return (
      <React.Fragment>
        {error && <Alert type="error">{error}</Alert>}

        <div data-test-id="onboarding-info">
          <PageHeading withMargins>{t('Create a new Project')}</PageHeading>
          <HelpText>
            {t(
              `Projects allow you to scope events to a specific application in
               your organization. For example, you might have separate projects
               for your API server and frontend client.`
            )}
          </HelpText>
          <PageHeading withMargins>{t('Choose a platform')}</PageHeading>
          <PlatformPicker platform={platform} setPlatform={this.setPlatform} showOther />
          <IssueAlertOptions
            onChange={updatedData => {
              this.setState({dataFragment: updatedData});
            }}
          />
          {this.renderProjectForm()}
        </div>
      </React.Fragment>
    );
  }
}

export default withApi(withTeams(withOrganization(CreateProject)));
export {CreateProject};

const CreateProjectForm = styled('form')`
  display: grid;
  grid-template-columns: 300px 250px max-content;
  grid-gap: ${space(2)};
  align-items: end;
  padding: ${space(3)} 0;
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
`;

const FormLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
`;

const ProjectNameInput = styled('div')`
  ${inputStyles};
  padding: 5px 10px;
  display: flex;
  align-items: center;

  input {
    border: 0;
    outline: 0;
    flex: 1;
  }
`;

const TeamSelectInput = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  align-items: center;
`;

const HelpText = styled('p')`
  color: ${p => p.theme.gray600};
  max-width: 700px;
`;
