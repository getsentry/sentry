import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {getInvestigationDetailQueryOptions} from 'sentry/views/investigations/api';
import {
  InvestigationBreachedMetricDetailFixture,
  InvestigationOrchestrationFixture,
  InvestigationActionRequestFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationDetail,
  InvestigationOrchestration,
  InvestigationActionRequest,
} from 'sentry/views/investigations/types';

const source = {
  type: 'metric_open_period',
  ref: {groupId: '123', openPeriodId: '456'},
  revision: null,
  snapshot: {
    monitor: {
      id: '789',
      name: 'Cart p95 latency',
      aggregate: 'p95(span.duration)',
      query: 'transaction:/api/cart',
      environment: 'production',
      detectionType: 'static',
      comparisonDeltaSeconds: null,
      timeWindowSeconds: 60,
      conditions: [
        {type: 'gt', comparison: 800, result: 75},
        {type: 'lte', comparison: 800, result: 0},
      ],
    },
    project: {id: '1', slug: 'checkout-api'},
  },
};

const intervalChange = InvestigationActionRequestFixture({
  title: 'Change the monitor’s interval from 1 minute to 10 minutes',
  rationale:
    'One or two slow requests at night don’t move a 10-minute p95, and it still catches sustained slowdowns.',
  impact:
    'Last 30 days with these settings: 1 issue instead of 15, and the Sep 12 slowdown still caught.',
  action: {
    kind: 'update_detector',
    detectorId: '789',
    before: {timeWindowSeconds: 60},
    changes: {timeWindowSeconds: 600},
    canApply: true,
    cannotApplyReason: null,
  },
});

const completedRun = InvestigationOrchestrationFixture({
  phase: 'completed',
  status: 'completed',
});

function makeInvestigation(
  id: string,
  actionRequests: InvestigationActionRequest[]
): InvestigationDetail {
  return InvestigationBreachedMetricDetailFixture({
    id,
    source,
    orchestration: {
      phase: 'completed',
      status: 'completed',
      heartbeatAt: null,
      notebookRevision: 5,
    },
    actionRequests,
  });
}

function LiveCard({investigationId}: {investigationId: string}) {
  const organization = useOrganization();
  const {data: investigation} = useQuery(
    getInvestigationDetailQueryOptions(organization.slug, investigationId)
  );

  return investigation ? <NextStepCard investigation={investigation} /> : null;
}

function CardStory({
  investigation,
  orchestration = completedRun,
}: {
  investigation: InvestigationDetail;
  orchestration?: InvestigationOrchestration;
}) {
  return (
    <InvestigationFixtureApi
      organizationSlug={`storybook-next-step-${investigation.id}`}
      details={[investigation]}
      orchestration={{[investigation.id]: orchestration}}
    >
      <Container maxWidth="960px">
        <LiveCard investigationId={investigation.id} />
      </Container>
    </InvestigationFixtureApi>
  );
}

export default Storybook.story('Investigations — Recommended Action', story => {
  story('Suggested monitor change', () => (
    <Fragment>
      <p>
        Seer's primary request from the latest report sits under the summary. Applying it
        edits the monitor as the viewer, so the button follows their permission to edit
        that monitor.
      </p>
      <CardStory investigation={makeInvestigation('suggested', [intervalChange])} />
    </Fragment>
  ));

  story('Threshold change', () => (
    <CardStory
      investigation={makeInvestigation('threshold', [
        {
          ...intervalChange,
          title: 'Raise the high threshold',
          rationale: 'Daytime p95 sits near 700 ms, so 650 ms fires on normal traffic.',
          impact: null,
          action: {
            kind: 'update_detector',
            detectorId: '789',
            before: {highThreshold: 650, resolutionThreshold: 650},
            changes: {highThreshold: 800, resolutionThreshold: 750},
            canApply: true,
            cannotApplyReason: null,
          },
        },
      ])}
    />
  ));

  story('Query change', () => (
    <CardStory
      investigation={makeInvestigation('query', [
        {
          ...intervalChange,
          title: 'Exclude handled errors',
          rationale:
            'Handled payment declines make up most of the errors this monitor counts.',
          impact: null,
          action: {
            kind: 'update_detector',
            detectorId: '789',
            before: {query: 'transaction:/api/cart'},
            changes: {query: 'transaction:/api/cart !error.handled:true'},
            canApply: true,
            cannotApplyReason: null,
          },
        },
      ])}
    />
  ));

  story('No action', () => (
    <Fragment>
      <p>
        Advice Seer cannot carry out has no monitor change, so the card shows the advice
        only.
      </p>
      <CardStory
        investigation={makeInvestigation('no-action', [
          {
            ...intervalChange,
            title: 'Instrument checkout retries',
            rationale:
              'Retries are invisible in spans, so the timeout cause could not be confirmed.',
            impact: null,
            action: null,
          },
        ])}
      />
    </Fragment>
  ));

  story('Withdrawn', () => (
    <CardStory
      investigation={makeInvestigation('withdrawn', [
        {
          ...intervalChange,
          state: 'withdrawn',
          reason: 'A second look showed the spikes are real breaches.',
        },
      ])}
    />
  ));
});
