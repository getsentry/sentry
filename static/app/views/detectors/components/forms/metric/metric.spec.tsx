import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {MemberListStore} from 'sentry/stores/memberListStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {NewMetricDetectorForm} from 'sentry/views/detectors/components/forms/metric/metric';

describe('NewMetricDetectorForm', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view'],
  });
  const project = ProjectFixture({id: '1', slug: 'proj-1'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.reset();
    OrganizationStore.onUpdate(organization);
    MemberListStore.init();
    MemberListStore.loadInitialData([UserFixture()]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: {measurements: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {attributes: {}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/is/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-teams/',
      body: [],
    });
  });

  it('shows default issue preview and updates subtitle when threshold changes', async () => {
    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <NewMetricDetectorForm />
      </DetectorFormProvider>,
      {organization}
    );

    // Default title and subtitle
    expect(await screen.findByText('Monitor title')).toBeInTheDocument();
    expect(
      screen.getByText('Critical: Number of errors above ... in 1 hour')
    ).toBeInTheDocument();

    // Change the monitor name and verify it updates the preview
    await userEvent.click(screen.getByTestId('editable-text-label'));
    await userEvent.clear(screen.getByRole('textbox', {name: 'Monitor Name'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Monitor Name'}),
      'My Custom Monitor'
    );
    await userEvent.keyboard('{Enter}');
    const preview = screen.getByTestId('issue-preview-section');
    expect(within(preview).getByText('My Custom Monitor')).toBeInTheDocument();

    // Change the high threshold
    await userEvent.type(screen.getByRole('spinbutton', {name: 'High threshold'}), '100');

    expect(
      within(preview).getByText('Critical: Number of errors above 100 in 1 hour')
    ).toBeInTheDocument();

    // Switch to percent change detection type — threshold value carries over
    await userEvent.click(screen.getByRole('radio', {name: /Change/i}));

    expect(
      within(preview).getByText(
        'Critical: Number of errors higher by 100% compared to past 1 hour'
      )
    ).toBeInTheDocument();

    // Clear and set a new percent threshold
    await userEvent.clear(screen.getByRole('spinbutton', {name: 'High threshold'}));
    await userEvent.type(screen.getByRole('spinbutton', {name: 'High threshold'}), '50');

    expect(
      within(preview).getByText(
        'Critical: Number of errors higher by 50% compared to past 1 hour'
      )
    ).toBeInTheDocument();

    // Switch to dynamic (anomaly) detection type
    await userEvent.click(screen.getByRole('radio', {name: /Dynamic/i}));

    expect(
      within(preview).getByText('Detected an anomaly in the query for Number of errors')
    ).toBeInTheDocument();

    // Change the assignee and verify it shows in the preview
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Default assignee'}),
      'Foo Bar'
    );
    expect(within(preview).getByText('FB')).toBeInTheDocument();
  });

  it('removes is filters when switching away from the errors dataset', async () => {
    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <NewMetricDetectorForm />
      </DetectorFormProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/new/metric/',
            query: {
              dataset: 'errors',
              query: 'is:unresolved status:500',
              project: project.id,
            },
          },
        },
      }
    );

    let search = await screen.findByTestId('search-query-builder');

    // Should have is:resolved and status:500 filters
    expect(within(search).getByRole('row', {name: 'is:unresolved'})).toBeInTheDocument();
    expect(within(search).getByRole('row', {name: 'status:500'})).toBeInTheDocument();

    // Switch to spans dataset
    await selectEvent.select(screen.getByLabelText(/dataset/i), 'Spans');

    search = await screen.findByTestId('search-query-builder');
    // is:unresolved filter should be removed
    expect(
      within(search).queryByRole('row', {name: 'is:unresolved'})
    ).not.toBeInTheDocument();
    // status:500 filter should still be present
    expect(within(search).getByRole('row', {name: 'status:500'})).toBeInTheDocument();
  });
});
