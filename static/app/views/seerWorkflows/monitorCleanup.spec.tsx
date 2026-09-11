import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorCleanupResults} from './monitorCleanup';

describe('MonitorCleanupResults', () => {
  it('shows an empty organization scan', () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[]}
        scanStatus="complete"
      />
    );
    expect(
      screen.getByText('0 monitors inspected across 0 projects')
    ).toBeInTheDocument();
  });

  it('marks incomplete project discovery even when returned projects are complete', () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        scanStatus="partial"
        results={[{id: '1', kind: 'duplicate_monitors', seerRunId: null, extras: output}]}
      />
    );
    expect(screen.getByText(/Some inspection is incomplete/)).toBeInTheDocument();
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

  it('renders real monitor links and an unconnected deletion button', async () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: '42',
            extras: output,
          },
        ]}
      />
    );
    expect(screen.getByRole('link', {name: 'Checkout errors'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/10/'
    );
    expect(screen.getByRole('link', {name: 'Checkout errors copy'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open Seer chat'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View comparison'}));
    expect(screen.getByRole('button', {name: 'Delete duplicates'})).toBeDisabled();
    expect(screen.queryByText(/Deletion is not available/)).not.toBeInTheDocument();
  });

  it('keeps evidence collapsed until the user opens a comparison', async () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: '42',
            extras: {
              ...output,
              findings: [
                {
                  ...output.findings[0],
                  comparison: [
                    {
                      property: 'Trigger',
                      values: [
                        {monitorId: '10', value: 'More than 100 errors'},
                        {monitorId: '11', value: 'More than 100 errors'},
                      ],
                    },
                    {
                      property: 'Window',
                      values: [
                        {monitorId: '10', value: '5 minutes'},
                        {monitorId: '11', value: '5 minutes'},
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
    expect(screen.getByRole('heading', {name: 'Exact duplicates'})).toBeInTheDocument();
    expect(screen.getAllByText('More than 100 errors')[0]).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'View comparison'}));
    expect(screen.getAllByText('More than 100 errors')[0]).toBeInTheDocument();
    expect(screen.getAllByText('5 minutes')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Same thresholds and automations')[0]).toBeInTheDocument();
    expect(screen.queryByText('Matching configurations')).not.toBeInTheDocument();
    expect(screen.getByText('2 monitors inspected across 1 project')).toBeInTheDocument();
    expect(screen.queryByText('0 possible duplicates')).not.toBeInTheDocument();
  });

  it('handles unknown output versions', () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        results={[
          {
            id: '1',
            kind: 'duplicate_monitors',
            seerRunId: null,
            extras: {...output, schemaVersion: 99},
          },
        ]}
      />
    );
    expect(
      screen.getByText('This monitor scan output is not supported.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not claim a partial empty scan found no duplicates', () => {
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
              scan: {status: 'partial', monitorsScanned: 0},
            },
          },
        ]}
      />
    );
    expect(
      screen.getByText('No candidates returned from the inspected monitors.')
    ).toBeInTheDocument();
  });
  it('distinguishes overlaps and notification risks without suggesting deletion', () => {
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
                  alerts: [
                    {
                      id: '20',
                      name: 'Checkout notifications',
                      enabled: false,
                    },
                  ],
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
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Suggested keep')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Delete duplicates'})
    ).not.toBeInTheDocument();
  });

  it('shows exact findings with a keeper and marks aggregate counts as incomplete', async () => {
    render(
      <MonitorCleanupResults
        organizationSlug="org-slug"
        scanStatus="partial"
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
                  reason: 'Identical effective settings.',
                },
              ],
            },
          },
        ]}
      />
    );
    expect(screen.getByRole('heading', {name: 'Exact duplicates'})).toBeInTheDocument();
    expect(screen.getByText('Suggested keep')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View comparison'}));
    expect(screen.getByRole('button', {name: 'Delete duplicates'})).toBeDisabled();
    expect(
      screen.getByText(/These counts cover the results received so far/)
    ).toBeInTheDocument();
  });
  it('compares each monitor by ID and marks differences without rendering the report', async () => {
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
                {
                  kind: 'overlapping_coverage',
                  monitors: output.findings[0]!.monitors,
                  suggestedKeepId: null,
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
    await userEvent.click(screen.getByRole('button', {name: 'View comparison'}));
    expect(
      screen.getByRole('columnheader', {name: 'Checkout errors'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', {
        name: 'Trigger >100 errors >500 errors',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Window 5 min 5 min'})).toBeInTheDocument();
    expect(screen.queryByText('Differs')).not.toBeInTheDocument();
  });
});
