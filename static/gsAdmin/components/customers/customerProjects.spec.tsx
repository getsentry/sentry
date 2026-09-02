import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {CustomerProjects} from 'admin/components/customers/customerProjects';

describe('CustomerProjects', () => {
  const org = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('ignores the page date range and always requests 30d stats', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [
        {
          ...ProjectFixture({slug: 'backend-project'}),
          stats: [
            [1, 3],
            [2, 4],
          ],
        },
      ],
    });

    render(<CustomerProjects orgId={org.slug} />, {
      initialRouterConfig: {
        location: {
          pathname: `/_admin/customers/${org.slug}/`,
          query: {
            statsPeriod: '3h',
            start: '2024-01-01T00:00:00',
            end: '2024-01-02T00:00:00',
          },
        },
      },
    });

    const projectRow = await screen.findByRole('row', {
      name: /backend-project/,
    });

    expect(within(projectRow).getByText('7')).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
    const requestData = projectsMock.mock.calls[0][1].data;
    expect(requestData).toEqual(
      expect.objectContaining({statsPeriod: '30d', per_page: 10})
    );
    expect(requestData).not.toHaveProperty('start');
    expect(requestData).not.toHaveProperty('end');
  });

  it('ignores a search query from the page URL', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    render(<CustomerProjects orgId={org.slug} />, {
      initialRouterConfig: {
        location: {
          pathname: `/_admin/customers/${org.slug}/`,
          query: {query: 'member@example.com', cursor: '0:100:0'},
        },
      },
    });

    await waitFor(() => expect(projectsMock).toHaveBeenCalledTimes(1));
    const requestData = projectsMock.mock.calls[0][1].data;
    expect(requestData).not.toHaveProperty('query');
    expect(requestData).toEqual(expect.objectContaining({cursor: ''}));
  });

  it('sends the search term with the stats period', async () => {
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [],
    });

    render(<CustomerProjects orgId={org.slug} />, {
      initialRouterConfig: {location: {pathname: `/_admin/customers/${org.slug}/`}},
    });

    await waitFor(() => expect(projectsMock).toHaveBeenCalledTimes(1));
    await userEvent.type(screen.getByPlaceholderText('Search'), 'backend');
    await userEvent.click(screen.getByRole('button', {name: 'Search'}));

    await waitFor(() => expect(projectsMock).toHaveBeenCalledTimes(2));
    expect(projectsMock.mock.calls[1][1].data).toEqual(
      expect.objectContaining({query: 'backend', statsPeriod: '30d', per_page: 10})
    );
  });
});
