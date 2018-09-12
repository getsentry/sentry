import React from 'react';

import getDisplayName from 'app/utils/getDisplayName';
import withLatestContext from 'app/utils/withLatestContext';

jest.mock('app/utils/withLatestContext');

const ACTIONS = {
  actions: {
    setSpecifier: jest.fn(),
    updateParams: jest.fn(),
  },
};

const withHealthMock = WrappedComponent => {
  const WrappedWithLatestContext = withLatestContext(WrappedComponent);

  class WithHealthMockWrapper extends React.Component {
    render() {
      return <WrappedWithLatestContext {...ACTIONS} {...this.props} />;
    }
  }
  WithHealthMockWrapper.displayName = `withHealthMock(${getDisplayName(
    WrappedComponent
  )})`;

  return WithHealthMockWrapper;
};

export default withHealthMock;
