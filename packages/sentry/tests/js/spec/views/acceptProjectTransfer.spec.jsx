import {mountWithTheme} from 'sentry-test/enzyme';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  let getMock;
  let postMock;
  const endpoint = '/accept-transfer/';
  beforeEach(function () {
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

  it('renders', function () {
    mountWithTheme(
      <AcceptProjectTransfer
        location={{
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />
    );

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', function () {
    const wrapper = mountWithTheme(
      <AcceptProjectTransfer
        location={{
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        }}
      />
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
