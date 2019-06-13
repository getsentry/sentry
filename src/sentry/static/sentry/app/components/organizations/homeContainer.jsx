import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

export default class HomeContainer extends React.Component {
  render() {
    return (
      <div className="organization-home">
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
