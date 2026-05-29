import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LowValueSpanIssueDetails} from './lowValueSpanIssueDetails';

describe('LowValueSpanIssueDetails', () => {
  it('renders only problem and troubleshooting sections from backend evidence', () => {
    render(
      <LowValueSpanIssueDetails
        event={EventFixture({
          occurrence: {
            evidenceData: {
              span_op: 'function',
              span_description: 'compute_checksum',
              span_count: 1234,
              extrapolated_count: 60_000,
              value_score: 0.15,
              avg_duration_ms: 0.4,
              estimated_cost_usd: 12.34,
              sdk_name: 'sentry.javascript.nextjs',
            },
            type: 13002,
          },
        })}
        group={GroupFixture()}
        project={ProjectFixture()}
      />
    );

    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getAllByText('function - compute_checksum').length).toBeGreaterThan(0);
    expect(screen.getByText('60,000')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(screen.queryByText('Value score')).not.toBeInTheDocument();
    expect(screen.queryByText('15%')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnosis')).not.toBeInTheDocument();
    expect(screen.queryByText('Impact')).not.toBeInTheDocument();
  });

  it('only reads the backend evidence field names', () => {
    render(
      <LowValueSpanIssueDetails
        event={EventFixture({
          occurrence: {
            evidenceData: {
              spanOp: 'function',
              spanDescription: 'compute_checksum',
              seenCount: 1234,
              avgDurationMs: 0.4,
              estimatedCostUsd: 12.34,
              sdkName: 'sentry.javascript.nextjs',
            },
            type: 13002,
          },
        })}
        group={GroupFixture()}
        project={ProjectFixture()}
      />
    );

    expect(screen.getAllByText('Unknown span').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.queryByText('function - compute_checksum')).not.toBeInTheDocument();
    expect(screen.queryByText('$12.34')).not.toBeInTheDocument();
  });
});
