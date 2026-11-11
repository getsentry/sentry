import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AcceptProjectTransfer from 'sentry/views/acceptProjectTransfer';

describe('AcceptProjectTransfer', () => {
  let getMock: jest.Mock;
  let postMock: jest.Mock;
  const endpoint = '/accept-transfer/';
  const originalInitialData = window.__initialData;

  beforeEach(() => {
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

  afterEach(() => {
    window.__initialData = originalInitialData;
  });

  it('renders', () => {
    render(<AcceptProjectTransfer />);

    expect(getMock).toHaveBeenCalled();
  });

  it('renders and fetches data from the region url', () => {
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

  it('submits', async () => {
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

    await userEvent.click(await screen.findByRole('button', {name: 'Transfer Project'}));

    expect(postMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'POST',
        host: 'http://us.sentry.io',
      })
    );
  });

  it.each([
    ['a single data param', 'signed-data', 'signed-data'],
    ['a repeated data param', ['signed-data', 'other-data'], undefined],
  ])(
    'submits the transfer data from the URL when given %s',
    async (_, data, expected) => {
      render(<AcceptProjectTransfer />, {
        initialRouterConfig: {
          location: {pathname: '/accept-transfer/', query: {data}},
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Transfer Project'})
      );

      expect(postMock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: {data: expected, organization: OrganizationFixture().slug},
        })
      );
    }
  );
});
