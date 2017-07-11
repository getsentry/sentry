import React from 'react';
import PlatformPicker from './platformpicker';
import PlatformCard from './platformCard';

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
        <h2>Choose a language or framework</h2>
        <PlatformPicker {...this.props} />
        <div style={{display: 'flex', height: '3em'}}>
          <div className="client-platform-list">
            <PlatformCard platform={this.props.platform} />
          </div>
          <input
            type="text"
            name="name"
            label="Project Name"
            placeholder="project name"
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
