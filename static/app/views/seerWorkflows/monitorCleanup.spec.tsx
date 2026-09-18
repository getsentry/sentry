import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorCleanupResults} from './monitorCleanup';

describe('MonitorCleanupResults', () => {
  it('shows an empty organization scan', () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[]}
        runStatus="complete"
      />
    );
    expect(
      screen.getByText('0 monitors inspected across 0 projects')
    ).toBeInTheDocument();
  });

  const output = {
    outputKind: 'monitor_cleanup',
    schemaVersion: 1,
    projectId: '1',
    projectSlug: 'project-slug',
    scan: {status: 'complete', monitorsScanned: 2},
    summary: 'Matching configurations',
    findings: [
      {
        kind: 'exact_duplicate',
        monitors: [
          {id: '10', name: 'Checkout errors', enabled: true},
          {id: '11', name: 'Checkout errors copy', enabled: true},
        ],
        suggestedKeepId: '10',
        alerts: [],
        comparison: [],
        reason: 'Same thresholds and automations',
      },
    ],
  };

  it('renders compatible output changes and reports malformed results', () => {
    const {rerender} = render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        runStatus="complete"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {
              schemaVersion: 99,
              projectId: output.projectId,
              projectSlug: output.projectSlug,
              scan: output.scan,
              findings: [
                {
                  kind: 'new_finding_kind',
                  monitors: output.findings[0]!.monitors,
                  newDetail: 'Additional context',
                },
              ],
            },
          },
        ]}
      />
    );
    expect(screen.getByRole('heading', {name: 'Monitor finding'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Checkout errors'})).toBeInTheDocument();
    expect(screen.getByText('2 monitors inspected across 1 project')).toBeInTheDocument();
    expect(screen.queryByText('Suggested keep')).not.toBeInTheDocument();
    expect(
      screen.queryByText('This monitor scan output is not supported.')
    ).not.toBeInTheDocument();

    const unsupportedResult = {
      id: '1',
      kind: 'duplicate_monitors',
      seerRunId: null,
      extras: {
        ...output,
        findings: [
          {
            ...output.findings[0],
            monitors: [{id: '../invalid', name: 'Invalid monitor'}],
          },
        ],
      },
    };
    rerender(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        runStatus="complete"
        results={[unsupportedResult]}
      />
    );
    expect(
      screen.getByText('This monitor scan output is not supported.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/monitors inspected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Some inspection is incomplete/)).not.toBeInTheDocument();

    rerender(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        runStatus="partial"
        results={[
          unsupportedResult,
          {id: '2', kind: 'duplicate_monitors', seerRunId: null, extras: output},
        ]}
      />
    );
    expect(screen.getByRole('link', {name: 'Checkout errors'})).toBeInTheDocument();
    expect(
      screen.getByText('This monitor scan output is not supported.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/monitors inspected/)).not.toBeInTheDocument();
  });

  it('treats an unknown scan status as incomplete', () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {
              ...output,
              findings: [],
              scan: {status: 'timed_out', monitorsScanned: 0},
            },
          },
        ]}
      />
    );
    expect(
      screen.getByText('No candidates returned from the inspected monitors.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Some inspection is incomplete/)).toBeInTheDocument();
  });
  it('distinguishes overlaps and notification risks', () => {
    const overlap = {
      kind: 'overlapping_coverage',
      monitors: output.findings[0]!.monitors,
      suggestedKeepId: null,
      alerts: [],
      reason: 'The timeout query is a subset of checkout errors.',
    };
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {
              ...output,
              schemaVersion: 1,
              findings: [
                overlap,
                {
                  ...overlap,
                  kind: 'duplicate_notifications',
                  reason: 'Both monitors connect to the same email alert.',
                  alerts: [{id: '20', name: 'Checkout notifications', enabled: false}],
                },
              ],
            },
          },
          {
            id: '2',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {
              ...output,
              projectId: '2',
              projectSlug: 'other-project',
              findings: [],
              scan: {status: 'complete', monitorsScanned: 3},
            },
          },
        ]}
      />
    );
    expect(
      screen.getByText('5 monitors inspected across 2 projects')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Overlapping coverage'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Potential duplicate notifications'})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Checkout notifications'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/alerts/20/'
    );
    expect(screen.queryByText('Suggested keep')).not.toBeInTheDocument();
  });

  it('renders monitor links, keeper, comparison, and incomplete coverage', async () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        runStatus="partial"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {
              ...output,
              schemaVersion: 1,
              findings: [
                {
                  kind: 'exact_duplicate',
                  monitors: output.findings[0]!.monitors,
                  suggestedKeepId: '10',
                  alerts: [],
                  reason: 'Same error stream, different thresholds.',
                  comparison: [
                    {
                      property: 'Trigger',
                      values: [
                        {monitorId: '11', value: '>500 errors'},
                        {monitorId: '10', value: '>100 errors'},
                      ],
                    },
                    {
                      property: 'Window',
                      values: [
                        {monitorId: '10', value: '5 min'},
                        {monitorId: '11', value: '5 min'},
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ]}
      />
    );
    expect(screen.getByRole('link', {name: 'Checkout errors'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/10/'
    );
    expect(screen.getByText('Suggested keep')).toBeInTheDocument();
    expect(screen.getByText(/Some inspection is incomplete/)).toBeInTheDocument();
    expect(screen.getByText('2 monitors inspected across 1 project')).toBeInTheDocument();
    expect(screen.getAllByText('>100 errors')[0]).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'View comparison'}));
    expect(
      screen.queryByRole('button', {name: 'Delete duplicates'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Checkout errors'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {name: 'Trigger >100 errors >500 errors'})
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Window 5 min 5 min'})).toBeInTheDocument();
    expect(screen.queryByText('Differs')).not.toBeInTheDocument();
  });
});
