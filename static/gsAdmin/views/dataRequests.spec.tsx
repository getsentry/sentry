import {render, screen} from 'sentry-test/reactTestingLibrary';

import DataRequests from 'admin/views/dataRequests';

describe('DataRequests', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders user results when searching globally (no orgSlug)', async () => {
    MockApiClient.addMockResponse({
      url: '/users/',
      body: [
        {
          id: '42',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      ],
    });

    render(<DataRequests />, {
      initialRouterConfig: {
        location: {
          pathname: '/_admin/data-requests/',
          query: {email: 'jane@example.com'},
        },
      },
    });

    expect(await screen.findByText('Results')).toBeInTheDocument();
    expect(screen.getByText('1 match found')).toBeInTheDocument();

    const userLink = screen.getByRole('link', {name: /Jane Smith/i});
    expect(userLink).toHaveAttribute('href', '/_admin/users/42/');
  });

  it('renders event results when searching within an org', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/acme/events/',
      body: [
        {
          id: 'abc123',
          title: 'Something bad happened',
          groupID: '1337',
        },
      ],
    });

    render(<DataRequests />, {
      initialRouterConfig: {
        location: {
          pathname: '/_admin/data-requests/',
          query: {orgSlug: 'acme', email: 'jane@example.com'},
        },
      },
    });

    expect(await screen.findByText('Results')).toBeInTheDocument();
    expect(screen.getByText('1 match found')).toBeInTheDocument();

    const eventLink = screen.getByRole('link', {
      name: /abc123 - Something bad happened/i,
    });
    expect(eventLink).toHaveAttribute('href', '/organizations/acme/issues/1337/');
  });
});
