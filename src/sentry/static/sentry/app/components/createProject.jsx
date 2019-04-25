import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';
import styled from 'react-emotion';

import {inputStyles} from 'app/styles/input';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import HookStore from 'app/stores/hookStore';
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

class CreateProject extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    teams: PropTypes.arrayOf(SentryTypes.Team),
    organization: SentryTypes.Organization,
    nextStepUrl: PropTypes.func,
  };

  static defaultProps = {
    nextStepUrl: ({slug, projectSlug, platform}) =>
      `/onboarding/${slug}/${projectSlug}/configure/${platform}`,
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
  }

  createProject = e => {
    e.preventDefault();
    const {organization, api, nextStepUrl} = this.props;
    const {projectName, platform, team} = this.state;
    const {slug} = organization;

    this.setState({inFlight: true});

    if (!projectName) {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('Onboarding no project name');
      });
    }

    api.request(`/teams/${slug}/${team}/projects/`, {
      method: 'POST',
      data: {
        name: projectName,
        platform,
      },
      success: data => {
        ProjectActions.createSuccess(data);

        const urlData = {
          slug: organization.slug,
          projectSlug: data.slug,
          platform: platform || 'other',
        };

        const defaultNextUrl = nextStepUrl(urlData);
        const hookNextUrl =
          organization.projects.length === 0 &&
          HookStore.get('utils:onboarding-survey-url').length &&
          HookStore.get('utils:onboarding-survey-url')[0](urlData, organization);

        browserHistory.push(hookNextUrl || defaultNextUrl);
      },
      error: err => {
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
            Sentry.captureMessage('Onboarding project creation failed');
          });
        }
      },
    });
  };

  setPlatform = platformId =>
    this.setState(({projectName, platform}) => ({
      platform: platformId,
      projectName:
        !projectName || (platform && getPlatformName(platform) === projectName)
          ? getPlatformName(platformId)
          : projectName,
    }));

  render() {
    const {organization} = this.props;
    const {projectName, team, platform, error, inFlight} = this.state;
    const teams = this.props.teams.filter(filterTeam => filterTeam.hasAccess);

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

          <PlatformPicker platform={platform} setPlatform={this.setPlatform} showOther />
          <CreateProjectForm onSubmit={this.createProject}>
            <div>
              <FormLabel>{t('Give your project a name')}</FormLabel>
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
              <FormLabel>{t('Assign a Team')}</FormLabel>
              <TeamSelectInput>
                <SelectControl
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
                disabled={inFlight || !team || projectName === ''}
              >
                {t('Create Project')}
              </Button>
            </div>
          </CreateProjectForm>
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
  margin-top: ${space(2)};
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.1);
  background: #fff;
  position: sticky;
  bottom: 0;
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
