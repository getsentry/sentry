import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';
import styled from '@emotion/styled';

import {inputStyles} from 'app/styles/input';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import PageHeading from 'app/components/pageHeading';
import PlatformIconTile from 'app/components/platformIconTile';
import PlatformPicker from 'app/components/platformPicker';
import ProjectActions from 'app/actions/projectActions';
import SelectControl from 'app/components/forms/selectControl';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import getPlatformName from 'app/utils/getPlatformName';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';
import IssueAlertOptions from 'app/views/projectInstall/issueAlertOptions';
import {trackAnalyticsEvent, logExperiment} from 'app/utils/analytics';

class CreateProject extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    teams: PropTypes.arrayOf(SentryTypes.Team),
    organization: SentryTypes.Organization,
    hasIssueAlertOptionsEnabled: PropTypes.bool,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  constructor(props, ...args) {
    super(props, ...args);

    const {query} = this.context.location;
    const {teams} = this.props.organization;
    const accessTeams = teams.filter(team => team.hasAccess);

    const team = query.team || (accessTeams.length && accessTeams[0].slug);
    const platform = getPlatformName(query.platform) ? query.platform : '';

    this.state = {
      error: false,
      projectName: getPlatformName(platform) || '',
      team,
      platform,
      inFlight: false,
    };

    if (this.props.hasIssueAlertOptionsEnabled) {
      this.state = {
        ...this.state,
        ...{
          dataFragment: {},
        },
      };
    }
  }

  componentDidMount() {
    // TODO(jeff): Change key to AlertDefaultExperiment on the real experiment run
    logExperiment({
      organization: this.props.organization,
      key: 'AlertDefaultExperimentTmp',
      unitName: 'org_id',
      unitId: parseInt(this.props.organization.id, 10),
      param: 'exposed',
    });
    trackAnalyticsEvent({
      eventKey: 'new_project.visited',
      eventName: 'New Project Page Visited',
      org_id: parseInt(this.props.organization.id, 10),
    });
  }

  renderProjectForm = (
    projectName,
    team,
    teams,
    platform,
    hasIssueAlertOptionsEnabled,
    organization,
    canSubmitForm
  ) => {
    const createProjectFormCaptured = (
      <CreateProjectForm onSubmit={this.createProject}>
        <div>
          <FormLabel>
            {hasIssueAlertOptionsEnabled
              ? t('Project name')
              : t('Give your project a name')}
          </FormLabel>
          <ProjectNameInput>
            <ProjectPlatformIcon monoTone platform={platform} />
            <input
              type="text"
              name="name"
              label={t('Project Name')}
              placeholder={t('Project name')}
              autoComplete="off"
              value={projectName}
              onChange={e => this.setState({projectName: e.target.value})}
            />
          </ProjectNameInput>
        </div>
        <div>
          <FormLabel>
            {hasIssueAlertOptionsEnabled ? t('Team') : t('Assign a Team')}
          </FormLabel>
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
                icon="icon-circle-add"
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
            disabled={!canSubmitForm}
          >
            {t('Create Project')}
          </Button>
        </div>
      </CreateProjectForm>
    );
    return hasIssueAlertOptionsEnabled ? (
      <React.Fragment>
        <PageHeading withMargins>{t('Give your project a name')}</PageHeading>
        {createProjectFormCaptured}
      </React.Fragment>
    ) : (
      <StickyWrapper>{createProjectFormCaptured}</StickyWrapper>
    );
  };

  canSubmitForm(inFlight, team, projectName, dataFragment, hasIssueAlertOptionsEnabled) {
    return (
      !inFlight &&
      team &&
      projectName !== '' &&
      (!hasIssueAlertOptionsEnabled ||
        !dataFragment?.shouldCreateCustomRule ||
        dataFragment?.conditions?.every?.(condition => condition.value))
    );
  }

  createProject = async e => {
    e.preventDefault();
    const {organization, api, hasIssueAlertOptionsEnabled} = this.props;
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
    } = hasIssueAlertOptionsEnabled ? dataFragment : {};

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

      let ruleId;
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
        organization,
        projectData,
        defaultRules,
        shouldCreateCustomRule,
        platform,
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
    organization,
    projectData,
    isDefaultRules,
    shouldCreateCustomRule,
    ruleId
  ) {
    let data = {
      eventKey: 'new_project.alert_rule_option_selected',
      eventName: 'New Project Alert Rule Option Selected',
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(projectData.id, 10),
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

  setPlatform = platformId =>
    this.setState(({projectName, platform}) => ({
      platform: platformId,
      projectName:
        !projectName || (platform && getPlatformName(platform) === projectName)
          ? getPlatformName(platformId)
          : projectName,
    }));

  render() {
    const {organization, hasIssueAlertOptionsEnabled} = this.props;
    const {projectName, team, platform, error, inFlight, dataFragment} = this.state;
    const teams = this.props.teams.filter(filterTeam => filterTeam.hasAccess);
    const canSubmitForm = this.canSubmitForm(
      inFlight,
      team,
      projectName,
      dataFragment,
      hasIssueAlertOptionsEnabled
    );
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
          {hasIssueAlertOptionsEnabled && (
            <PageHeading withMargins>{t('Choose a platform')}</PageHeading>
          )}
          <PlatformPicker platform={platform} setPlatform={this.setPlatform} showOther />
          {hasIssueAlertOptionsEnabled && (
            <IssueAlertOptions
              onChange={updatedData => {
                this.setState({dataFragment: updatedData});
              }}
            />
          )}
          {this.renderProjectForm(
            projectName,
            team,
            teams,
            platform,
            hasIssueAlertOptionsEnabled,
            organization,
            canSubmitForm
          )}
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

const ProjectPlatformIcon = styled(PlatformIconTile)`
  font-size: 25px;
`;

const ProjectNameInput = styled('div')`
  ${inputStyles};
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  padding: 5px 10px;

  input {
    border: 0;
    outline: 0;
  }
`;

const TeamSelectInput = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  align-items: center;
`;

const HelpText = styled('p')`
  color: ${p => p.theme.gray3};
  max-width: 700px;
`;

const StickyWrapper = styled('div')`
  position: sticky;
  background: #fff;
  bottom: 0;
`;
