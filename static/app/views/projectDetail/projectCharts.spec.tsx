import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectCharts from 'sentry/views/projectDetail/projectCharts';

function renderProjectCharts(
  features?: string[],
  platform?: string,
  chartDisplay?: string
) {
  const {organization, router, project} = initializeOrg({
    organization: TestStubs.Organization({features}),
    projects: [{platform}],
    router: {
      params: {orgId: 'org-slug', projectId: 'project-slug'},
      location: {
        pathname: '/organizations/org-slug/projects/project-slug/',
        query: {chart1: chartDisplay ?? 'crash_free'},
      },
    },
  } as Parameters<typeof initializeOrg>[0]);

  return render(
    <ProjectCharts
      chartId="chart1"
      chartIndex={0}
      hasSessions
      hasTransactions
      location={router.location}
      organization={organization}
      router={router}
      visibleCharts={['chart1', 'chart2']}
      project={project}
    />
  );
}

describe('ProjectDetail > ProjectCharts', () => {
  let mockSessions;
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/stats/`,
      body: [],
    });

    mockSessions = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(session)`,
      }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders ANR options', () => {
    renderProjectCharts(['anr-rate'], 'android');

    userEvent.click(screen.getByRole('button', {name: 'Display Crash Free Sessions'}));

    expect(screen.getByText('Foreground ANR Rate')).toBeInTheDocument();
    expect(screen.getByText('ANR Rate')).toBeInTheDocument();
  });

  it('does not render ANR options for non-android platforms', () => {
    renderProjectCharts(['anr-rate'], 'python');

    userEvent.click(screen.getByRole('button', {name: 'Display Crash Free Sessions'}));

    expect(screen.queryByText('Foreground ANR Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('ANR Rate')).not.toBeInTheDocument();
  });

  it('makes the right ANR sessions request', async () => {
    const responseBody = {
      query: '',
      intervals: [
        '2021-03-05T00:00:00Z',
        '2021-03-06T00:00:00Z',
        '2021-03-07T00:00:00Z',
        '2021-03-08T00:00:00Z',
        '2021-03-09T00:00:00Z',
        '2021-03-10T00:00:00Z',
        '2021-03-11T00:00:00Z',
        '2021-03-12T00:00:00Z',
        '2021-03-13T00:00:00Z',
        '2021-03-14T00:00:00Z',
        '2021-03-15T00:00:00Z',
        '2021-03-16T00:00:00Z',
        '2021-03-17T00:00:00Z',
        '2021-03-18T00:00:00Z',
      ],
      groups: [
        {
          by: {},
          totals: {
            'anr_rate()': 492,
            'count_unique(user)': 3,
          },
          series: {
            'anr_rate()': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 490],
            'count_unique(user)': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
          },
        },
      ],
    };
    mockSessions = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/sessions/',
      body: responseBody,
    });
    renderProjectCharts(['anr-rate'], 'android', 'anr_rate');
    expect(screen.getByText('ANR Rate')).toBeInTheDocument();

    await waitFor(() =>
      expect(mockSessions).toHaveBeenCalledWith(
        '/organizations/org-slug/sessions/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['anr_rate()', 'count_unique(user)'],
          }),
        })
      )
    );
  });
});
