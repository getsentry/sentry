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
import {HypothesisList} from 'sentry/views/investigations/hypotheses/hypothesisList';
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

  story('Statuses', () => (
    <Fragment>
      <p>
        A card renders <code>effectiveStatus</code>, which already folds the agent verdict
        and any user disposition into the run status. Confidence only appears once the
        agent has settled on a verdict, so work in progress shows a bare label and a
        pulsing dot.
      </p>
      <p>
        The border carries the verdict: accent for a supported hypothesis, dotted while a
        hypothesis is inconclusive, and an ordinary border everywhere else — refuted
        included, since ruling something out is a result rather than a fault.
      </p>
      <Storybook.Demo direction="column" align="stretch">
        <HypothesisList hypotheses={InvestigationHypothesesFixture()} />
      </Storybook.Demo>
      <p>
        Nothing has settled yet in these, so none of them carry confidence and the failed
        hypothesis shows why it stopped.
      </p>
      <Storybook.Demo direction="column" align="stretch">
        <HypothesisList
          hypotheses={[
            InvestigationHypothesisFixture({
              id: 'pending',
              order: 0,
              statement: 'Queued behind the broad scan',
              rationale: '',
              status: 'queued',
              effectiveStatus: 'pending',
              confidence: null,
              agentVerdict: null,
              verificationSteps: [],
            }),
            InvestigationHypothesisFixture({
              id: 'investigating',
              order: 1,
              statement: 'A slow dependency upgrade changed request timing',
              rationale: 'Checking whether the regression tracks the deploy.',
              status: 'running',
              effectiveStatus: 'investigating',
              confidence: null,
              agentVerdict: null,
              verificationSteps: [
                InvestigationVerificationStepFixture({
                  id: 'running-step',
                  title: 'Compare timing across releases',
                  status: 'running',
                  result: null,
                }),
                InvestigationVerificationStepFixture({
                  id: 'queued-step',
                  order: 1,
                  title: 'Inspect dependency spans',
                  status: 'queued',
                  result: null,
                }),
              ],
            }),
            InvestigationHypothesisFixture({
              id: 'failed',
              order: 2,
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
      <Storybook.Demo direction="column" align="stretch">
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
      <Storybook.Demo direction="column" align="stretch">
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
