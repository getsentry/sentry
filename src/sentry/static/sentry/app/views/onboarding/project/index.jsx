import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';

import Hook from 'app/components/hook';
import {analytics} from 'app/utils/analytics';
import PlatformPicker from 'app/views/onboarding/project/platformpicker';
import PlatformiconTile from 'app/views/onboarding/project/platformiconTile';
import SelectField from 'app/components/forms/selectField';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

class OnboardingProject extends React.Component {
  static propTypes = {
    next: PropTypes.func,
    setPlatform: PropTypes.func,
    platform: PropTypes.string,
    setName: PropTypes.func,
    name: PropTypes.string,
    team: PropTypes.string,
    setTeam: PropTypes.func,
    teams: PropTypes.array,
    organization: SentryTypes.Organization,
    onSurveySubmit: PropTypes.func,
    showSurvey: PropTypes.bool,
  };

  static defaultProps = {
    team: '',
    setTeam: () => {},
    teams: [],
  };

  constructor(...args) {
    super(...args);
    this.state = {projectRequired: false};
  }

  componentWillReceiveProps(newProps) {
    this.setWarning(newProps.name);
  }

  setWarning = value => {
    this.setState({projectRequired: !value});
  };

  submit = () => {
    this.setWarning(this.props.name);
    if (this.props.name) {
      analytics('platformpicker.create_project');
      this.props.next();
    }
  };

  renderTeamPicker = () => {
    let {team, teams, setTeam} = this.props;
    return (
      <div className="new-project-team">
        <h4>{t('Team') + ':'}</h4>
        <div>
          <SelectField
            name="select-team"
            clearable={false}
            value={team}
            style={{width: 180, marginBottom: 0}}
            onChange={val => setTeam(val)}
            options={teams.map(({slug}) => ({
              label: `#${slug}`,
              value: slug,
            }))}
          />
        </div>
      </div>
    );
  };

  renderSurvey = () => {
    let {organization, onSurveySubmit} = this.props;
    let params = {organization, onSubmit: onSurveySubmit};
    return (
      <Hook name="component:onboarding-survey" params={params} key="onboarding-survey" />
    );
  };

  renderBody = () => {
    return (
      <div className="onboarding-info">
        <h4>{t('Choose a language or framework') + ':'}</h4>
        <PlatformPicker {...this.props} showOther={true} />
        <div className="create-project-form">
          <div className="new-project-name client-platform">
            <h4>{t('Give your project a name') + ':'}</h4>
            <div
              className={classnames('project-name-wrapper', {
                required: this.state.projectRequired,
              })}
            >
              <PlatformiconTile platform={this.props.platform} />
              <input
                type="text"
                name="name"
                label={t('Project Name')}
                placeholder={t('Project name')}
                autoComplete="off"
                value={this.props.name}
                onChange={e => this.props.setName(e.target.value)}
              />
            </div>
          </div>
          {this.renderTeamPicker()}
          <div>
            <button className="btn btn-primary new-project-submit" onClick={this.submit}>
              {t('Create Project')}
            </button>
          </div>
          <p>
            {t(
              'Projects allow you to scope events to a specific application in your organization. For example, you might have separate projects for your API server and frontend client.'
            )}
          </p>
        </div>
      </div>
    );
  };

  render() {
    return <div>{this.props.showSurvey ? this.renderSurvey() : this.renderBody()}</div>;
  }
}

export default OnboardingProject;
