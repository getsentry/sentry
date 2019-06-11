import React from 'react';
import styled from 'react-emotion';

import ProjectNav from 'app/views/organizationProjectsDashboard/projectNav';
import space from 'app/styles/space';

export default class HomeContainer extends React.Component {
  render() {
    return (
      <div className={`${this.props.className || ''} organization-home`}>
        <ProjectNav />
        <div className="container">
          <Content>{this.props.children}</Content>
        </div>
      </div>
    );
  }
}

const Content = styled('div')`
  padding-top: ${space(3)};
`;
