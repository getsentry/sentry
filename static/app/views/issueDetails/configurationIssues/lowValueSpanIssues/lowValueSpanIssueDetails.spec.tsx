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
              analysisEnd: '2026-06-01T07:32:25.403623+00:00',
              analysisStart: '2026-06-01T01:32:25.403623+00:00',
              avgDurationMs: 0.4,
              count: 1234,
              description: 'compute_checksum',
              estimatedCostUsd: 12.34,
              extrapolatedCount: 60_000,
              op: 'function',
              sdkName: 'sentry.javascript.nextjs',
              spanOrigin: 'auto',
              valueScore: 0.15,
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

});
