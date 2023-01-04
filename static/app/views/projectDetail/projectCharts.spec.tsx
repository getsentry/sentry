import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectCharts from 'sentry/views/projectDetail/projectCharts';

function renderProjectCharts(features?: string[], platforms?: string[]) {
  const {organization, router, project} = initializeOrg({
    organization: TestStubs.Organization({features}),
    projects: [{platforms}],
    router: {
      params: {orgId: 'org-slug', groupId: 'group-id'},
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
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/releases/stats/`,
      body: [],
    });

    MockApiClient.addMockResponse({
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
    renderProjectCharts(['anr-rate'], ['python', 'android']);

    userEvent.click(screen.getByRole('button', {name: 'Display Crash Free Sessions'}));

    expect(screen.getByText('Foreground ANR Rate')).toBeInTheDocument();
    expect(screen.getByText('ANR Rate')).toBeInTheDocument();
  });

  it('does not render ANR options for non-android platforms', () => {
    renderProjectCharts(['anr-rate'], ['python']);

    userEvent.click(screen.getByRole('button', {name: 'Display Crash Free Sessions'}));

    expect(screen.queryByText('Foreground ANR Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('ANR Rate')).not.toBeInTheDocument();
  });
});
