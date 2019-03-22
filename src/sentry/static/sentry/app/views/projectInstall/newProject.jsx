import React from 'react';
import createReactClass from 'create-react-class';
import DocumentTitle from 'react-document-title';
import styled from 'react-emotion';
import space from 'app/styles/space';

import OrganizationState from 'app/mixins/organizationState';

import CreateProject from 'app/views/onboarding/createProject';
import ProjectSelector from 'app/components/projectHeader/projectSelector';

const NewProject = createReactClass({
  displayName: 'NewProject',
  mixins: [OrganizationState],

  render() {
    const hasSentry10 = this.getFeatures().has('sentry10');
    return (
      <Container>
        {!hasSentry10 && (
          <div className="sub-header flex flex-container flex-vertically-centered">
            <div className="p-t-1 p-b-1">
              <ProjectSelector organization={this.getOrganization()} />
            </div>
          </div>
        )}
        <div className="container">
          <Content>
            <DocumentTitle title={'Sentry'} />
            <CreateProject
              getDocsUrl={({slug, projectSlug, platform}) => {
                if (platform === 'other') {
                  platform = '';
                }
                return `/${slug}/${projectSlug}/getting-started/${platform}`;
              }}
            />
          </Content>
        </div>
      </Container>
    );
  },
});

const Container = styled('div')`
  flex: 1;
  background: #fff;
  margin-bottom: -${space(3)}; /* cleans up a bg gap at bottom */
`;

const Content = styled('div')`
  margin-top: ${space(3)};
`;

export default NewProject;
