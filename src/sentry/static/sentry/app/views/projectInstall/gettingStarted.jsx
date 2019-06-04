import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import ProjectContext from 'app/views/projects/projectContext';
import space from 'app/styles/space';

class GettingStartedBody extends React.Component {
  static contextTypes = {
    project: PropTypes.object,
    organization: PropTypes.object,
  };

  render() {
    return (
      <Container>
        <div className="container">
          <Content>{this.props.children}</Content>
        </div>
      </Container>
    );
  }
}

class GettingStarted extends React.Component {
  render() {
    const {projectId, orgId} = this.props.params;
    return (
      <ProjectContext orgId={orgId} projectId={projectId}>
        <GettingStartedBody>{this.props.children}</GettingStartedBody>
      </ProjectContext>
    );
  }
}

const Container = styled('div')`
  flex: 1;
  background: #fff;
  margin-bottom: -${space(3)}; /* cleans up a bg gap at bottom */
`;

const Content = styled('div')`
  margin-top: ${space(3)};
`;

export default GettingStarted;
