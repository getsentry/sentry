import React from 'react';
import PlatformPicker from './platformpicker';

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
        <h2>Select a language or framework</h2>
        <PlatformPicker {...this.props} />
        <div style={{display: 'flex'}}>
          <div className="client-platform-list">
            <span className={`platformicon platformicon-${this.props.platform}`} />
            <span
              className={`platformicon  platformicon-${this.props.platform.split('-')[0]}`}
            />
          </div>

          <input
            type="text"
            name="name"
            label="Project Name"
            placeholder="project name"
            value={this.props.name}
            onChange={e => this.props.setName(e.target.value)}
          />
          <div className="btn btn-primary" onClick={this.submit}>
            next step
          </div>
        </div>
      </div>
    );
  }
});

export default Project;
