import React from 'react';
import classnames from 'classnames';

import PlatformPicker from './platformpicker';
import PlatformiconTile from './platformiconTile';
import SelectInput from '../../../components/selectInput';
import {t} from '../../../locale';

const Project = React.createClass({
  propTypes: {
    next: React.PropTypes.func,
    setPlatform: React.PropTypes.func,
    platform: React.PropTypes.string,
    setName: React.PropTypes.func,
    name: React.PropTypes.string,
    team: React.PropTypes.string,
    setTeam: React.PropTypes.func,
    teams: React.PropTypes.array
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
            style={{width: 120, padding: '10px'}}
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
        <h4>{t('Choose a language or framework' + ':')}</h4>
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
                value={this.props.name}
                onChange={e => this.props.setName(e.target.value)}
              />
            </div>
          </div>
          <this.renderTeamPicker />
          <div>
            <button className="btn btn-primary submit-new-team" onClick={this.submit}>
              {t('Continue')}
            </button>
          </div>
        </div>
      </div>
    );
  }
});

export default Project;
