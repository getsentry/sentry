import React from 'react';

const withOrganizationMock = WrappedComponent =>
  class WithOrganizationMockWrappeer extends React.Component {
    render() {
      return <WrappedComponent organization={TestStubs.Organization()} {...this.props} />;
    }
  };

export default withOrganizationMock;
