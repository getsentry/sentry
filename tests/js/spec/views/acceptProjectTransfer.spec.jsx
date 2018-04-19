import React from 'react';

import {mount} from 'enzyme';
import AcceptProjectTransfer from 'app/views/acceptProjectTransfer';

jest.mock('jquery');

describe('AcceptProjectTransfer', function() {
  let getMock;
  let postMock;
  let endpoint = '/accept-transfer/';
  beforeEach(function() {
    MockApiClient.clearMockResponses();

    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: TestStubs.Project(),
        organizations: [TestStubs.Organization({teams: [TestStubs.Team()]})],
      },
    });

    postMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'POST',
      statusCode: 204,
    });
  });

  it('renders', function() {
    mount(
      <AcceptProjectTransfer
        location={{
          pathame: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />,
      TestStubs.routerContext()
    );

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', function() {
    let wrapper = mount(
      <AcceptProjectTransfer
        location={{
          pathame: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('form').simulate('submit');

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
