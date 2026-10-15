import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TraceProfiles} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceProfiles';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

describe('TraceProfiles', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({slug: 'backend', platform: 'python'}),
    ]);
  });

  it('renders a row linking to each profile when the trace has profiled events', () => {
    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'transaction-profiled',
          is_transaction: true,
          op: 'http.server',
          description: 'GET /api/users',
          project_slug: 'backend',
          profile_id: 'abcdef0123456789',
          start_timestamp: 1,
          end_timestamp: 2,
          children: [
            makeEAPSpan({
              event_id: 'transaction-continuous',
              is_transaction: true,
              op: 'queue.task',
              description: 'process_job',
              project_slug: 'backend',
              profiler_id: '9876543210fedcba',
              start_timestamp: 1,
              end_timestamp: 2,
            }),
          ],
        }),
      ]),
      {organization, replay: null}
    );

    render(<TraceProfiles tree={tree} />, {organization});

    const table = screen.getByRole('table', {name: 'Profiled Events'});
    const rows = within(table).getAllByRole('row');
    const [, transactionRow, continuousRow] = rows;

    expect(rows).toHaveLength(3);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Profiled Events', 'Profile']);
    expect(
      within(transactionRow!)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['http.server — GET /api/users', 'abcdef01']);
    expect(within(transactionRow!).getByRole('link', {name: 'abcdef01'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiles/profile/backend/abcdef0123456789/flamegraph/'
    );
    expect(
      within(continuousRow!)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['queue.task — process_job', '98765432']);
    expect(within(continuousRow!).getByRole('link', {name: '98765432'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiles/profile/backend/flamegraph/?end=1970-01-01T00%3A00%3A02.000Z&profilerId=9876543210fedcba&start=1970-01-01T00%3A00%3A01.000Z'
    );
  });
});
