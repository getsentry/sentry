import React from 'react';
import PlatformPicker from './platformpicker';
import PlatformiconTile from './platformiconTile';
// import ProjectDocsContext from '../../projectInstall/docsContext';

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
        {/* <ProjectDocsContext> */}
        <PlatformPicker {...this.props} />
        {/* </ProjectDocsContext> */}
        <div className="project-name client-platform">
          <h4>Give your project a name:</h4>
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
          {/* <div className="clien-platform-list"> */}
          {/* </div> */}
          <div className="btn btn-primary pull-right" onClick={this.submit}>
            Continue
          </div>
        </div>
      </div>
    );
  }
});

export default Project;
