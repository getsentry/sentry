import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from 'react-emotion';

import CreateProject from 'app/components/createProject';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

const NewProject = ({organization}) => (
  <Container>
    <div className="container">
      <Content>
        <DocumentTitle title="Sentry" />
        <CreateProject
          nextStepUrl={({slug, projectSlug, platform}) =>
            `/${slug}/${projectSlug}/getting-started/${platform}/`
          }
        />
      </Content>
    </div>
  </Container>
);

NewProject.propTypes = {
  organization: SentryTypes.Organization.isRequired,
};

const Container = styled('div')`
  flex: 1;
  background: #fff;
  margin-bottom: -${space(3)}; /* cleans up a bg gap at bottom */
`;

const Content = styled('div')`
  margin-top: ${space(3)};
`;

export default withOrganization(NewProject);
