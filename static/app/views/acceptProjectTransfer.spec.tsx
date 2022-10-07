import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  let getMock: jest.Mock<any>;
  let postMock: jest.Mock<any>;
  const router = TestStubs.router();
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
    render(
      <AcceptProjectTransfer
        location={TestStubs.location({
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        })}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        params={{}}
      />
    );

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', function () {
    render(
      <AcceptProjectTransfer
        location={TestStubs.location({
          pathname: 'endpoint',
          query: {data: 'XYZ'},
        })}
        route={{}}
        routeParams={router.params}
        router={router}
        routes={router.routes}
        params={{}}
      />
    );

    userEvent.click(screen.getByText('Transfer Project'));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
