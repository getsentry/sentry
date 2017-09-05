import PropTypes from 'prop-types';
import React from 'react';
import classnames from 'classnames';

import PlatformPicker from './platformpicker';
import PlatformiconTile from './platformiconTile';
import SelectInput from '../../../components/selectInput';
import {t} from '../../../locale';

const OnboardingProject = React.createClass({
  propTypes: {
    next: PropTypes.func,
    setPlatform: PropTypes.func,
    platform: PropTypes.string,
    setName: PropTypes.func,
    name: PropTypes.string,
    team: PropTypes.string,
    setTeam: PropTypes.func,
    teams: PropTypes.array
  },

  getDefaultProps() {
    return {
      team: '',
      setTeam: () => {},
      teams: []
    };
  },

  getInitialState() {
    return {projectRequired: false};
  },

  componentWillReceiveProps(newProps) {
    this.setWarning(newProps.name);
  },

  setWarning(value) {
    this.setState({projectRequired: !value});
  },

  submit() {
    this.setWarning(this.props.name);
    if (this.props.name) this.props.next();
  },
  renderTeamPicker() {
    let {team, teams, setTeam} = this.props;
    if (teams.length < 2) return null;
    return (
      <div className="new-project-team">
        <h4>{t('Team') + ':'}</h4>
        <div className="project-team-wrapper">
          <SelectInput
            value={team}
            style={{width: 180, padding: '10px'}}
            required={true}
            onChange={e => setTeam(e[0].value)}>
            {teams.map(({slug, name, id}, i) => (
              <option key={id} value={slug}>{name}</option>
            ))}
          </SelectInput>
        </div>
      </div>
    );
  },

  render() {
    return (
      <div className="onboarding-info">
        <h4>{t('Choose a language or framework') + ':'}</h4>
        <PlatformPicker {...this.props} showOther={true} />
        <div className="create-project-form">
          <div className="new-project-name client-platform">
            <h4>{t('Give your project a name') + ':'}</h4>
            <div
              className={classnames('project-name-wrapper', {
                required: this.state.projectRequired
              })}>
              <PlatformiconTile platform={this.props.platform} />
              <input
                type="text"
                name="name"
                label="Project Name"
                placeholder="Project name"
                autoComplete="off"
                value={this.props.name}
                onChange={e => this.props.setName(e.target.value)}
              />
            </div>
          </div>
          {this.renderTeamPicker()}
          <div>
            <button className="btn btn-primary submit-new-team" onClick={this.submit}>
              {t('Create Project')}
            </button>
          </div>
          <p>
            {t(
              'Projects allow you to scope events to a specific application in your organization. For example, you might have separate projects your API server and frontend client.'
            )}
          </p>
        </div>
      </div>
    );
  }
});

export default OnboardingProject;
