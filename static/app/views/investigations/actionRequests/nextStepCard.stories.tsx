import {Fragment, type ComponentProps} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';
import {commentStoryAuthors} from 'sentry/views/investigations/__stories__/commentStoryFixtures';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {getInvestigationDetailQueryOptions} from 'sentry/views/investigations/api';
import {
  InvestigationActionRequestFixture,
  InvestigationDetailFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationActionRequest,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

const intervalChange = InvestigationActionRequestFixture({
  title: 'Change the monitor’s interval from 1 minute to 10 minutes',
  rationale:
    'One or two slow requests at night don’t move a 10-minute p95, and it still catches sustained slowdowns.',
  impact:
    'Last 30 days with these settings: 1 issue instead of 15, and the Sep 12 slowdown still caught.',
});

const completedRun = InvestigationOrchestrationFixture({
  phase: 'completed',
  status: 'completed',
});

function runWith(
  status: 'generating' | 'failed',
  overrides: Partial<InvestigationOrchestration> = {}
) {
  return InvestigationOrchestrationFixture({
    ...completedRun,
    ...overrides,
    report: {...completedRun.report, nextStep: {status, error: null}},
  });
}

function investigationWith(id: string, actionRequests: InvestigationActionRequest[]) {
  return InvestigationDetailFixture({id, actionRequests});
}

function CardStory({
  actionRequests,
  dryRunErrors,
  id,
  orchestration = completedRun,
}: {
  actionRequests: InvestigationActionRequest[];
  id: string;
  dryRunErrors?: ComponentProps<typeof InvestigationFixtureApi>['dryRunErrors'];
  orchestration?: InvestigationOrchestration;
}) {
  return (
    <InvestigationFixtureApi
      organizationSlug={`storybook-next-step-${id}`}
      details={[investigationWith(id, actionRequests)]}
      dryRunErrors={dryRunErrors}
    >
      <Container maxWidth="960px">
        <FixtureCard investigationId={id} orchestration={orchestration} />
      </Container>
    </InvestigationFixtureApi>
  );
}

function FixtureCard({
  investigationId,
  orchestration,
}: {
  investigationId: string;
  orchestration: InvestigationOrchestration;
}) {
  const organization = useOrganization();
  const {data: investigation} = useQuery(
    getInvestigationDetailQueryOptions(organization.slug, investigationId)
  );
  return (
    <NextStepCard
      actionRequests={investigation?.actionRequests}
      investigationId={investigationId}
      orchestration={orchestration}
    />
  );
}

const connectSuggestion: InvestigationActionRequest = {
  ...intervalChange,
  key: 'connect-telemetry-datadog-r1',
  title: 'Connect Datadog',
  rationale: 'The payment processor logs to Datadog, which Seer cannot read yet.',
  impact: null,
  action: {kind: 'connect_telemetry', provider: 'datadog'},
};

export default Storybook.story('Investigations — Recommended Action', story => {
  story('Suggested', () => (
    <Fragment>
      <Text as="p">
        Seer's primary request from the latest report sits under the summary.
      </Text>
      <CardStory id="suggested" actionRequests={[intervalChange]} />
    </Fragment>
  ));

  story('Cannot apply', () => (
    <CardStory
      id="cannot-apply"
      actionRequests={[
        {...intervalChange, canApply: false, cannotApplyReason: 'permission_denied'},
      ]}
    />
  ));

  story('Check failed', () => (
    <CardStory
      id="check-failed"
      actionRequests={[intervalChange]}
      dryRunErrors={{
        [intervalChange.id]: {
          status: 409,
          body: {
            detail: 'This changed since Seer suggested it.',
            code: 'stale',
            current: {timeWindowSeconds: 600},
          },
        },
      }}
    />
  ));

  story('Threshold change', () => (
    <CardStory
      id="threshold"
      actionRequests={[
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
          },
        },
      ]}
    />
  ));

  story('Query change', () => (
    <CardStory
      id="query"
      actionRequests={[
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
          },
        },
      ]}
    />
  ));

  story('No action', () => (
    <Fragment>
      <Text as="p">
        Advice Seer cannot carry out has no action, so the card shows the advice only.
      </Text>
      <CardStory
        id="no-action"
        actionRequests={[
          {
            ...intervalChange,
            title: 'Instrument checkout retries',
            rationale:
              'Retries are invisible in spans, so the timeout cause could not be confirmed.',
            impact: null,
            action: null,
          },
        ]}
      />
    </Fragment>
  ));

  story('Applied', () => (
    <CardStory
      id="applied"
      actionRequests={[
        {
          ...intervalChange,
          state: 'applied',
          canApply: false,
          cannotApplyReason: 'not_suggested',
          appliedBy: commentStoryAuthors.GRACE,
          dateApplied: '2026-08-27T15:00:00Z',
        },
      ]}
    />
  ));

  story('Stale', () => (
    <CardStory
      id="stale"
      actionRequests={[
        {
          ...intervalChange,
          state: 'superseded',
          canApply: false,
          cannotApplyReason: 'not_suggested',
          error: {code: 'stale', current: {timeWindowSeconds: 120}},
        },
      ]}
    />
  ));

  story('Re-checking', () => (
    <CardStory
      id="rechecking"
      actionRequests={[
        {
          ...intervalChange,
          state: 'superseded',
          canApply: false,
          cannotApplyReason: 'not_suggested',
          error: {code: 'stale', current: {timeWindowSeconds: 120}},
          followUp: {status: 'accepted', reason: null, rerun: null, retryable: false},
        },
      ]}
    />
  ));

  story('Connect a provider', () => (
    <Fragment>
      <Text as="p">
        When the run cannot confirm a cause because telemetry is missing, Seer asks to
        connect the provider. The button opens its integration settings. Once the
        integration is connected, Sentry applies the request and Seer re-runs the
        investigation.
      </Text>
      <CardStory
        id="connect"
        actionRequests={[connectSuggestion]}
        dryRunErrors={{
          [connectSuggestion.id]: {
            status: 400,
            body: {
              detail: "The change wasn't valid.",
              code: 'validation_failed',
              messages: ["This provider isn't connected yet."],
            },
          },
        }}
      />
    </Fragment>
  ));

  story('Provider connected', () => (
    <Fragment>
      <Text as="p">
        When the user comes back from connecting the provider before Sentry has applied
        the request, the card offers to re-run the investigation with it.
      </Text>
      <CardStory id="connected" actionRequests={[connectSuggestion]} />
    </Fragment>
  ));

  story('Withdrawn', () => (
    <CardStory
      id="withdrawn"
      actionRequests={[
        {
          ...intervalChange,
          state: 'withdrawn',
          reason: 'A second look showed the spikes are real breaches.',
        },
      ]}
    />
  ));

  story('Generating', () => (
    <CardStory
      id="generating"
      actionRequests={[]}
      orchestration={runWith('generating', {phase: 'metadata', status: 'processing'})}
    />
  ));

  story('Failed', () => (
    <CardStory id="failed" actionRequests={[]} orchestration={runWith('failed')} />
  ));
});
