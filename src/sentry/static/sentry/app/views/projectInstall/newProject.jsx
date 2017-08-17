import React from 'react';
import DocumentTitle from 'react-document-title';

import CreateProject from '../onboarding/createProject';
import ProjectSelector from '../../components/projectHeader/projectSelector';

const newProject = React.createClass({
  contextTypes: {
    organization: React.PropTypes.object
  },

  render() {
    return (
      <div className="getting-started">
        <div className="sub-header flex flex-container flex-vertically-centered">
          <div className="p-t-1 p-b-1">
            <ProjectSelector organization={this.context.organization} />
          </div>
        </div>
        <div className="container">
          <div className="content">
            <DocumentTitle title={'Sentry'} />
            <CreateProject
              getDocsUrl={({slug, projectSlug, platform}) => {
                if (platform === 'other') platform = '';
                return `/${slug}/${projectSlug}/getting-started/${platform}`;
              }}
            />
          </div>
        </div>
      </div>
    );
  }
});

export default newProject;
