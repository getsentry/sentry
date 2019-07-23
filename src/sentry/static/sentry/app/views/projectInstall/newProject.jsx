import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from 'react-emotion';

import CreateProject from 'app/components/createProject';
import space from 'app/styles/space';

const NewProject = () => (
  <Container>
    <div className="container">
      <Content>
        <DocumentTitle title="Sentry" />
        <CreateProject />
      </Content>
    </div>
  </Container>
);

const Container = styled('div')`
  flex: 1;
  background: #fff;
  margin-bottom: -${space(3)}; /* cleans up a bg gap at bottom */
`;

const Content = styled('div')`
  margin-top: ${space(3)};
`;

export default NewProject;
