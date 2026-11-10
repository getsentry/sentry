import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {FAILURE_FIELDS, ISSUE_VOLUME_FIELDS} from './queries';
import ProjectSymbolicationErrors from '.';

describe('ProjectSymbolicationErrors', () => {
  const organization = OrganizationFixture({features: ['symbolication-errors-page']});
  const project = ProjectFixture();
  const eventsUrl = `/organizations/${organization.slug}/events/`;
  const statsUrl = `/organizations/${organization.slug}/events-stats/`;

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/projects/${project.slug}/symbolication-errors/`,
    },
  };

  function mockFailures(body: unknown) {
    return MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: FAILURE_FIELDS})],
      body,
    });
  }

  beforeEach(() => {
    MockApiClient.addMockResponse({url: statsUrl, body: {data: []}});
    MockApiClient.addMockResponse({
      url: statsUrl,
      match: [MockApiClient.matchQuery({dataset: 'errors', topEvents: 10})],
      body: {
        'PROJ-1': {
          data: [
            [1700000000, [{count: 10}]],
            [1700003600, [{count: 20}]],
          ],
          order: 0,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: statsUrl,
      match: [MockApiClient.matchQuery({dataset: 'processing_errors', topEvents: 10})],
      body: {
        '1,native_missing_dsym': {
          data: [
            [1700000000, [{count: 4}]],
            [1700003600, [{count: 6}]],
          ],
          order: 0,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: ISSUE_VOLUME_FIELDS})],
      body: {
        data: [{'issue.id': 1, issue: 'PROJ-1', 'count()': 250}],
      },
    });
    mockFailures({
      data: [
        {
          group_id: 1,
          title: 'EXC_BAD_ACCESS in main',
          error_type: 'native_missing_dsym',
          'count_unique(event_id)': 100,
        },
      ],
    });
  });

  it('lists the issues with their volumes and failure trend', async () => {
    render(<ProjectSymbolicationErrors />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('link', {name: 'EXC_BAD_ACCESS in main'})
    ).toHaveAttribute('href', `/organizations/${organization.slug}/issues/1/`);
    expect(screen.getByText('Missing debug file')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Upload debug files'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${project.slug}/debug-symbols/`
    );
    expect(await screen.findByText('PROJ-1')).toBeInTheDocument();
    expect(await screen.findByText('100 / 250')).toBeInTheDocument();
    expect(
      await screen.findByRole('img', {name: 'Symbolication failure trend, peak 6'})
    ).toBeInTheDocument();
  });

  it('opens the fix steps of a row', async () => {
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: ['release', 'count_unique(event_id)']})],
      body: {data: [{release: 'app@1.2.3', 'count_unique(event_id)': 80}]},
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({field: ['event_id']})],
      body: {data: [{event_id: 'abc123'}]},
    });

    render(<ProjectSymbolicationErrors />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'How to fix'}));

    const drawer = await screen.findByRole('complementary', {
      name: 'Symbolication failure details',
    });
    expect(
      await within(drawer).findByRole('link', {name: 'app@1.2.3'})
    ).toBeInTheDocument();
    expect(
      within(drawer).getByText(
        `sentry-cli debug-files upload --org ${organization.slug} --project ${project.slug} <path-to-debug-files>`
      )
    ).toBeInTheDocument();
    expect(
      await within(drawer).findByRole('link', {name: 'EXC_BAD_ACCESS in main'})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/1/events/abc123/`
    );

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});
    await userEvent.click(
      within(drawer).getByRole('button', {name: 'Copy Prompt for AI Agent'})
    );

    const prompt = writeText.mock.calls[0][0];
    expect(prompt).toContain('Cause: Missing debug file (`native_missing_dsym`)');
    expect(prompt).toContain('Affected releases: app@1.2.3 (80 events)');
    expect(prompt).toContain('Sample event ID: abc123');
    expect(prompt).toContain(
      `sentry-cli debug-files upload --org ${organization.slug} --project ${project.slug}`
    );
  });

  it('shows the empty state when no errors exist', async () => {
    mockFailures({data: []});

    render(<ProjectSymbolicationErrors />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByText(
        'Every event in the last 30 days symbolicated without errors.'
      )
    ).toBeInTheDocument();
  });

  it('shows a 404 without the flag', () => {
    render(<ProjectSymbolicationErrors />, {
      organization: OrganizationFixture(),
      outletContext: {project},
      initialRouterConfig,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
    expect(screen.queryByText('Symbolication Errors')).not.toBeInTheDocument();
  });
});
