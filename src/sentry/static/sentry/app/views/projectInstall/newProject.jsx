import React from 'react';
import createReactClass from 'create-react-class';
import DocumentTitle from 'react-document-title';

import OrganizationState from 'app/mixins/organizationState';

import CreateProject from 'app/views/onboarding/createProject';
import ProjectSelector from 'app/components/projectHeader/projectSelector';

const NewProject = createReactClass({
  displayName: 'NewProject',
  mixins: [OrganizationState],

  render() {
    return (
      <div className="getting-started">
        <div className="sub-header flex flex-container flex-vertically-centered">
          <div className="p-t-1 p-b-1">
            <ProjectSelector organization={this.getOrganization()} />
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
  },
});

export default NewProject;
