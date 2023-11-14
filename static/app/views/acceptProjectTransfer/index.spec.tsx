import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  const {routerProps} = initializeOrg();

  let getMock: jest.Mock;
  let postMock: jest.Mock;
  const endpoint = '/accept-transfer/';

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: TestStubs.Project(),
        organizations: [Organization({teams: [TestStubs.Team()]})],
      },
    });

    postMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'POST',
      statusCode: 204,
    });
  });

  it('renders', function () {
    render(<AcceptProjectTransfer {...routerProps} />);

    expect(getMock).toHaveBeenCalled();
  });

  it('renders and fetches data from the region url', function () {
    window.__initialData = {
      ...window.__initialData,
      links: {
        regionUrl: 'http://us.sentry.io',
        sentryUrl: 'http://sentry.io',
        organizationUrl: 'http://acme.sentry.io',
      },
    };
    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: TestStubs.Project(),
        organizations: [Organization({teams: [TestStubs.Team()]})],
      },
      match: [(_url, options) => options.host === 'http://us.sentry.io'],
    });
    render(<AcceptProjectTransfer {...routerProps} />);

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', async function () {
    render(<AcceptProjectTransfer {...routerProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Transfer Project'}));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
