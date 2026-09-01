import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
          ...ProjectFixture(),
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

    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
    const requestData = projectsMock.mock.calls[0][1].data;
    expect(requestData).toEqual(
      expect.objectContaining({statsPeriod: '30d', per_page: 10})
    );
    expect(requestData).not.toHaveProperty('start');
    expect(requestData).not.toHaveProperty('end');
  });
});
