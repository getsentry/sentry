import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {InvestigationFixtureApi} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {
  InvestigationDetailFixture,
  InvestigationHypothesesFixture,
  InvestigationHypothesisFixture,
  InvestigationOrchestrationFixture,
  InvestigationVerificationStepFixture,
} from 'sentry/views/investigations/fixtures';
import {
  HypothesisList,
  HypothesisListPlaceholder,
} from 'sentry/views/investigations/hypotheses/hypothesisList';
import {InvestigationHypotheses} from 'sentry/views/investigations/hypotheses/investigationHypotheses';

export default Storybook.story('Investigations — Hypotheses', story => {
  story('The hypothesis row', () => (
    <Fragment>
      <p>
        An agentic investigation proposes several explanations, tests each one, and lands
        on a verdict. The row shows them side by side so the alternatives that were ruled
        out stay visible next to the one that survived.
      </p>
      <p>
        The data comes from <code>projection.hypotheses</code> on the orchestration
        endpoint, and the lifted card is <code>report.primaryHypothesisId</code>.
      </p>
      <p>
        The row is a grid of <code>minmax(260px, 1fr)</code> tracks with{' '}
        <code>auto-fit</code>, so it drops columns whenever its own box stops fitting
        another readable card — the viewport is never consulted. Drag the demo's edge to
        watch it reflow.
      </p>
      <Storybook.Demo resizable direction="column" align="stretch">
        <HypothesisList
          hypotheses={InvestigationHypothesesFixture()}
          primaryHypothesisId="hypothesis-1"
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('Before the first hypothesis', () => (
    <Fragment>
      <p>
        There is a real dead window at the start of a run. Intake, broad scan and planning
        all happen before the agent has written a single hypothesis, and together they
        cover a good share of a run's opening stretch. Rendering nothing there leaves a
        blank area under a status block that says work is happening, and then drops the
        whole row in at once.
      </p>
      <p>
        The placeholder uses the row's own column sizing, so its single card is as wide as
        the first real card and that card's arrival moves nothing. It holds one card
        rather than guessing how many hypotheses a run will produce.
      </p>
      <Storybook.Demo resizable direction="column" align="stretch" maxHeight="none">
        <HypothesisListPlaceholder />
      </Storybook.Demo>
      <p>
        The same rows appear inside a <em>real</em> card whose statement has arrived but
        whose checks have not. A hypothesis that settled without any checks gets none —
        there is nothing on its way to hold space for.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList
          hypotheses={[
            InvestigationHypothesisFixture({
              id: 'unplanned',
              order: 0,
              statement: 'A cache stampede followed the deploy',
              effectiveStatus: 'pending',
              confidence: null,
              agentVerdict: null,
              verificationSteps: [],
            }),
          ]}
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('Statuses', () => (
    <Fragment>
      <p>
        A card renders <code>effectiveStatus</code>, which already folds the agent verdict
        and any user disposition into the run status. Its verdict status appears beside
        the hypothesis number, without a confidence percentage.
      </p>
      <p>
        The border carries the verdict three ways. A thicker solid accent edge marks the
        explanation that stands — supported by the evidence, or accepted by a person. A
        dashed edge marks a card that was checked and is not the answer: ruled out,
        inconclusive, failed and cancelled all read the same way to someone scanning the
        row, so the status carries that distinction rather than the border. A hypothesis
        still being investigated keeps an ordinary solid edge, because dashing it would
        announce a verdict the agent has not reached.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList hypotheses={InvestigationHypothesesFixture()} />
      </Storybook.Demo>
      <p>
        A hypothesis in flight is all one <code>effectiveStatus</code>, but it passes
        through several states worth naming: formed, having its checks planned, running
        them, and done checking but not yet judged. Those are read off the verification
        steps, since that is the only place the distinction exists. Only the running state
        has a purple dot and label; the other three are gray. All four keep a solid
        border: dashing one would announce a verdict the agent has not reached.
        Verification steps show only their titles in a connected timeline. The current
        step has a filled dark circle and primary text; other steps have hollow circles
        and muted text.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList hypotheses={inFlightHypotheses()} />
      </Storybook.Demo>
      <p>
        A failure is the one in-flight state that gets a colour, because it is the only
        one that has stopped. The hypothesis says why; like any settled card, its checks
        fold behind a toggle.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList
          hypotheses={[
            InvestigationHypothesisFixture({
              id: 'failed',
              order: 0,
              statement: 'A regional outage degraded the response',
              rationale: 'The investigator could not complete this check.',
              status: 'failed',
              effectiveStatus: 'failed',
              confidence: null,
              agentVerdict: null,
              error: {
                code: 'no_data',
                message: 'No traces covered the incident window.',
                retryable: false,
              },
              verificationSteps: [
                InvestigationVerificationStepFixture({
                  id: 'failed-step',
                  title: 'Compare error rate by region',
                  status: 'failed',
                  result: null,
                  error: {
                    code: 'timeout',
                    message: 'The query timed out.',
                    retryable: true,
                  },
                }),
              ],
            }),
          ]}
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('Many checks', () => (
    <Fragment>
      <p>
        While verifying, past two checks the timeline collapses to the first running check
        — where the agent is — behind a toggle that names how many are hidden. Once a
        verdict lands, every check folds away behind a toggle to show all of them, since
        the verdict is what the card is about by then. Either way, opening it shows every
        check with a toggle to collapse them again.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList
          hypotheses={[
            InvestigationHypothesisFixture({
              id: 'many-checks-verifying',
              order: 0,
              statement: 'A cache regression slowed organization lookups',
              rationale: 'Four checks have completed and the fifth is running.',
              status: 'running',
              effectiveStatus: 'investigating',
              confidence: null,
              agentVerdict: null,
              verificationSteps: manyVerificationSteps(4),
            }),
            InvestigationHypothesisFixture({
              id: 'many-checks-settled',
              order: 1,
              statement: 'A cache regression slowed organization lookups',
              rationale: 'Every check has reported and the evidence supports it.',
              verificationSteps: manyVerificationSteps(null),
            }),
          ]}
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('Live, against a mocked orchestration API', () => (
    <Fragment>
      <p>
        <code>InvestigationHypotheses</code> reads the projection from{' '}
        <code>/investigations/$id/orchestration/</code> and posts decisions back to{' '}
        <code>/orchestration/commands/</code>. Here both are served by{' '}
        <code>InvestigationFixtureApi</code>, the in-memory fake the other investigations
        stories use, so this is the real component and the real data flow with only the
        network swapped out.
      </p>
      <p>
        Accept or reject a hypothesis from its overflow menu: the fixture applies the
        command, bumps <code>workflowVersion</code>, and returns the new projection, which
        the mutation writes straight into the query cache. Accepting turns the border
        accent; choosing the same decision twice clears it and hands the hypothesis back
        to the agent's verdict.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <InvestigationFixtureApi
          organizationSlug="hypotheses-story"
          details={[InvestigationDetailFixture({id: 'investigation-1', blocks: []})]}
          orchestration={{'investigation-1': InvestigationOrchestrationFixture()}}
        >
          <InvestigationHypotheses investigationId="investigation-1" />
        </InvestigationFixtureApi>
      </Storybook.Demo>
    </Fragment>
  ));

  story('With actions', () => (
    <Fragment>
      <p>
        Cards do not own commands. The surface rendering them decides which of accept,
        reject, steer, and retry apply, and posts the chosen one to{' '}
        <code>/orchestration/commands/</code>. Leave <code>getActions</code> off — as the
        rows above do — and the overflow menu disappears, which is what a read-only
        surface wants.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <HypothesisList
          hypotheses={InvestigationHypothesesFixture()}
          primaryHypothesisId="hypothesis-1"
          getActions={hypothesis => [
            {key: 'accept', label: 'Accept', onAction: () => {}},
            {key: 'reject', label: 'Reject', onAction: () => {}},
            {
              key: 'retry',
              label: 'Investigate again',
              disabled: hypothesis.effectiveStatus === 'investigating',
              onAction: () => {},
            },
          ]}
        />
      </Storybook.Demo>
    </Fragment>
  ));
});

/** The four states a hypothesis passes through before it is judged. */
function inFlightHypotheses() {
  return [
    InvestigationHypothesisFixture({
      id: 'formed',
      order: 0,
      statement: 'A slow dependency upgrade changed request timing',
      rationale: 'Nothing has been planned to test this yet.',
      status: 'queued',
      effectiveStatus: 'pending',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [],
    }),
    InvestigationHypothesisFixture({
      id: 'preparing',
      order: 1,
      statement: 'A cache warm-up left the first requests cold',
      rationale: 'The checks are planned but none has started.',
      status: 'queued',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({
          id: 'preparing-step',
          title: 'Compare cold and warm cache windows',
          status: 'queued',
          result: null,
        }),
      ],
    }),
    InvestigationHypothesisFixture({
      id: 'checking',
      order: 2,
      statement: 'A noisy neighbour saturated the shared pool',
      rationale: 'Two checks have completed and the next check is running.',
      status: 'running',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({
          id: 'checking-completed',
          title: 'Compare pool saturation across tenants',
          status: 'completed',
          result: 'Saturation increased across all tenants.',
        }),
        InvestigationVerificationStepFixture({
          id: 'checking-completed-connection',
          order: 1,
          title: 'Inspect connection wait time',
          status: 'completed',
          result: 'Connection wait time increased.',
        }),
        InvestigationVerificationStepFixture({
          id: 'checking-step',
          order: 2,
          title: 'Checking Redis latency and connection usage',
          status: 'running',
          result: null,
        }),
      ],
    }),
    InvestigationHypothesisFixture({
      id: 'checked',
      order: 3,
      statement: 'A retry storm amplified the original delay',
      rationale: 'Every check has reported; the verdict has not landed yet.',
      status: 'running',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({
          id: 'checked-step',
          title: 'Compare retry volume with latency',
          status: 'completed',
          result: 'Retries tripled while the p95 climbed.',
        }),
      ],
    }),
  ];
}

/**
 * Seven checks, those before `runningIndex` done, that one running and the rest
 * queued. `null` finishes all of them.
 */
function manyVerificationSteps(runningIndex: number | null) {
  return [
    'Compare FCP and server response time',
    'Compare organization lookup spans',
    'Inspect cache and Redis behavior',
    'Compare cache misses with response time',
    'Check Redis latency and connection usage',
    'Compare affected and unaffected organizations',
    'Review database and cache evidence',
  ].map((title, order) => {
    const status =
      runningIndex === null || order < runningIndex
        ? 'completed'
        : order === runningIndex
          ? 'running'
          : 'queued';
    return InvestigationVerificationStepFixture({
      id: `many-step-${order}`,
      order,
      title,
      status,
      result: status === 'completed' ? 'Done.' : null,
    });
  });
}
