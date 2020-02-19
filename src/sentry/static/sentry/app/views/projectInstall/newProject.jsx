import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from '@emotion/styled';

import CreateProject from 'app/views/projectInstall/createProject';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';
import SentryTypes from 'app/sentryTypes';

const NewProject = ({organization}) => (
  <Container>
    <div className="container">
      <Content>
        <DocumentTitle title="Sentry" />
        <CreateProject
          hasIssueAlertOptionsEnabled={
            organization.experiments?.AlertDefaultsExperiment === 1
          }
        />
      </Content>
    </div>
  </Container>
);

NewProject.propTypes = {
  organization: SentryTypes.Organization,
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
