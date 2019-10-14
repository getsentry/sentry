import React from 'react';
import {mount, shallow} from 'sentry-test/enzyme';
import {Client} from 'app/api';

import AsyncComponent from 'app/components/asyncComponent';

describe('AsyncComponent', function() {
  class TestAsyncComponent extends AsyncComponent {
    shouldRenderBadRequests = true;

    constructor(props) {
      super(props);
      this.state = {};
    }

    getEndpoints() {
      return [['data', '/some/path/to/something/']];
    }

    renderBody() {
      return <div>{this.state.data.message}</div>;
    }
  }

  it('renders on successful request', function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/some/path/to/something/',
      method: 'GET',
      body: {
        message: 'hi',
      },
    });
    const wrapper = shallow(<TestAsyncComponent />);
    expect(wrapper.find('div')).toHaveLength(1);
    expect(wrapper.find('div').text()).toEqual('hi');
  });

  it('renders error message', function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/some/path/to/something/',
      method: 'GET',
      body: {
        detail: 'oops there was a problem',
      },
      statusCode: 400,
    });
    const wrapper = mount(<TestAsyncComponent />);
    expect(wrapper.find('LoadingError')).toHaveLength(1);
    expect(
      wrapper
        .find('LoadingError')
        .find('p')
        .text()
    ).toEqual('oops there was a problem');
  });
});
