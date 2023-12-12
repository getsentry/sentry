import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {EventGroupVariantType} from 'sentry/types';

import GroupingVariant from './groupingVariant';

describe('Grouping Variant', () => {
  const event = EventFixture({
    entries: [
      {
        type: 'spans',
        data: [
          {
            span_id: '1',
            hash: 'hash1',
          },
          {
            span_id: '2',
            hash: 'hash2',
          },
        ],
      },
    ],
  });
  const occurrenceEvent = EventFixture({
    ...event,
    occurrence: {
      fingerprint: ['test-fingerprint'],
      evidenceData: {
        op: 'db',
        offenderSpanIds: ['2'],
        causeSpanIds: ['1'],
        parentSpanIds: [],
      },
    },
  });
  const performanceIssueVariant = {
    type: EventGroupVariantType.PERFORMANCE_PROBLEM,
    description: 'performance issue',
    hash: 'hash3',
    hashMismatch: false,
    key: 'perf-issue',
    evidence: {
      desc: 'performance issue',
      fingerprint: 'a',
      cause_span_ids: ['1'],
      offender_span_ids: ['2'],
      parent_span_ids: [],
    },
  };

  it('renders the span hashes for performance issues from event data', () => {
    render(
      <GroupingVariant
        showGroupingConfig={false}
        variant={performanceIssueVariant}
        event={event}
      />
    );

    expect(
      within(screen.getByText('Parent Span Hashes').closest('tr') as HTMLElement)
        .getByText('[')
        .closest('td')
    ).toHaveTextContent('[]');
    expect(
      within(
        screen.getByText('Source Span Hashes').closest('tr') as HTMLElement
      ).getByText('hash1')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText('Offender Span Hashes').closest('tr') as HTMLElement
      ).getByText('hash2')
    ).toBeInTheDocument();
  });

  it('renders grouping details for occurrence-backed performance issues', () => {
    render(
      <GroupingVariant
        showGroupingConfig={false}
        variant={performanceIssueVariant}
        event={occurrenceEvent}
      />
    );

    expect(
      within(screen.getByText('Parent Span Hashes').closest('tr') as HTMLElement)
        .getByText('[')
        .closest('td')
    ).toHaveTextContent('[]');
    expect(
      within(
        screen.getByText('Source Span Hashes').closest('tr') as HTMLElement
      ).getByText('hash1')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByText('Offender Span Hashes').closest('tr') as HTMLElement
      ).getByText('hash2')
    ).toBeInTheDocument();
  });
});
