import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', function () {
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  const endpoint = '/accept-transfer/';

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    getMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'GET',
      body: {
        project: ProjectFixture(),
        organizations: [OrganizationFixture()],
      },
    });

    postMock = MockApiClient.addMockResponse({
      url: '/accept-transfer/',
      method: 'POST',
      statusCode: 204,
    });
  });

  it('renders', function () {
    render(<AcceptProjectTransfer />);

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
        project: ProjectFixture(),
        organizations: [OrganizationFixture()],
      },
      match: [(_url, options) => options.host === 'http://us.sentry.io'],
    });
    render(<AcceptProjectTransfer />);

    expect(getMock).toHaveBeenCalled();
  });

  it('submits', async function () {
    render(<AcceptProjectTransfer />);

    await userEvent.click(await screen.findByRole('button', {name: 'Transfer Project'}));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        host: 'http://us.sentry.io',
      })
    );
  });
});
