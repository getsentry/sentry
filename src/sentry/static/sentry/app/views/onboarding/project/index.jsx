import React from 'react';
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

  submit() {
    this.props.next();
  },

  render() {
    return (
      <div className="onboarding-info">
        <h2>{t('Choose a language or framework')}</h2>
        <PlatformPicker {...this.props} />
        <div className="project-name client-platform">
          <h4>{t('Give your project a name') + ':'}</h4>
          <div className="project-name-wrapper">
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
          <div className="btn btn-primary pull-right" onClick={this.submit}>
            {t('Continue')}
          </div>
        </div>
      </div>
    );
  }
});

export default Project;
