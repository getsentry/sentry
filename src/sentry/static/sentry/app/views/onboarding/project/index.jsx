import React from 'react';
import classnames from 'classnames';

import PlatformPicker from './platformpicker';
import PlatformiconTile from './platformiconTile';
import {t} from '../../../locale';

const Project = React.createClass({
  propTypes: {
    next: React.PropTypes.func,
    setPlatform: React.PropTypes.func,
    platform: React.PropTypes.string,
    setName: React.PropTypes.func,
    name: React.PropTypes.string
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

  render() {
    return (
      <div className="onboarding-info">
        <h2>{t('Choose a language or framework')}</h2>
        <PlatformPicker {...this.props} showOther={true} />
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
          <button className="btn btn-primary pull-right" onClick={this.submit}>
            {t('Continue')}
          </button>
        </div>
      </div>
    );
  }
});

export default Project;
