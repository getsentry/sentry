import {Fragment} from 'react';

import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {
  InvestigationHypothesisFixture,
  InvestigationVerificationStepFixture,
} from 'sentry/views/investigations/fixtures';
import {HypothesisStatus} from 'sentry/views/investigations/hypotheses/hypothesisStatus';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

export default Storybook.story('Investigations — Hypothesis status', story => {
  story('A verdict the agent reached', () => (
    <Fragment>
      <p>
        The status box is the dot-and-label line a hypothesis card leads with. It is not a
        render of one field: the label comes from <code>effectiveStatus</code>,{' '}
        <code>decisionSource</code> and the shape of <code>verificationSteps</code>{' '}
        together. Every row below is the projection shape that actually produces that box.
      </p>
      <p>
        Confidence is only meaningful once the agent has settled, so it is appended only
        for those statuses. It is read from <code>hypothesis.confidence</code>, falling
        back to <code>agentVerdict.confidence</code> for a projection that has filled in
        only the latter.
      </p>
      <p>
        Colour is deliberately sparing. <code>supported</code> and <code>accepted</code>{' '}
        are the only greens. <code>refuted</code> and <code>inconclusive</code> are amber:
        a hypothesis the agent tested and closed is not an error, but it is still a result
        worth registering as you scan the row. <code>rejected</code> and{' '}
        <code>cancelled</code> stay muted — nobody tested those — and of the settled
        statuses only <code>failed</code> is dangerous.
      </p>
      <StatusBoxes rows={SETTLED} />
    </Fragment>
  ));

  story('A decision the viewer made', () => (
    <Fragment>
      <p>
        A person accepting or rejecting a hypothesis lands in the same{' '}
        <code>effectiveStatus</code> as the agent doing it, so{' '}
        <code>decisionSource: 'user'</code> is the only thing separating them. The box
        says which it was out loud, because whose call it was changes how the rest of the
        report should be read.
      </p>
      <StatusBoxes rows={USER_DECISIONS} />
    </Fragment>
  ));

  story('While the agent is still working', () => (
    <Fragment>
      <p>
        These four are all <code>effectiveStatus: 'pending'</code> or{' '}
        <code>'investigating'</code>. The distinction between them exists nowhere but the
        verification steps, so the box reads it off them: no steps at all means nothing
        has been planned yet, and steps that have every one produced something means only
        the verdict is missing.
      </p>
      <p>
        Only <em>Verifying…</em> is coloured, and it is the only one drawn as a spinning
        ring rather than a dot — the agent is doing something, where the others are places
        the hypothesis has come to a stop, however briefly. A column of moving indicators
        would claim everything is live when nothing is.
      </p>
      <StatusBoxes rows={IN_FLIGHT} />
    </Fragment>
  ));

  story('A status Sentry does not know yet', () => (
    <Fragment>
      <p>
        Hypothesis statuses are an open set: Seer can introduce one before this code knows
        its name. Rather than drop it, an unrecognized value is humanized and rendered
        muted, so a new status degrades to a readable label instead of an empty box.
      </p>
      <StatusBoxes rows={UNKNOWN} />
    </Fragment>
  ));
});

type StatusBoxRow = {
  /** What in the projection puts the hypothesis into this state. */
  caption: string;
  hypothesis: InvestigationHypothesis;
  key: string;
};

/** Each box beside the projection shape that produces it. */
function StatusBoxes({rows}: {rows: StatusBoxRow[]}) {
  return (
    <Storybook.Demo direction="column" align="stretch" maxHeight="none">
      <Grid columns="max-content 1fr" gap="md xl" align="center">
        {rows.map(row => (
          <Fragment key={row.key}>
            <HypothesisStatus hypothesis={row.hypothesis} />
            <Text size="xs" variant="muted" density="comfortable">
              {row.caption}
            </Text>
          </Fragment>
        ))}
      </Grid>
    </Storybook.Demo>
  );
}

const SETTLED: StatusBoxRow[] = [
  {
    key: 'supported',
    caption: "effectiveStatus: 'supported' — the explanation that stands",
    hypothesis: InvestigationHypothesisFixture(),
  },
  {
    key: 'accepted',
    caption: "effectiveStatus: 'accepted', decisionSource: 'agent'",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'accepted',
      decisionSource: 'agent',
      confidence: 0.92,
    }),
  },
  {
    key: 'refuted',
    caption: "effectiveStatus: 'refuted' — tested and closed, so it reads amber",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'refuted',
      confidence: 0.91,
    }),
  },
  {
    key: 'rejected',
    caption: "effectiveStatus: 'rejected', decisionSource: 'agent'",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'rejected',
      decisionSource: 'agent',
      confidence: 0.77,
    }),
  },
  {
    key: 'inconclusive',
    caption: "effectiveStatus: 'inconclusive' — checked, but nothing settled it",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'inconclusive',
      confidence: 0.34,
    }),
  },
  {
    key: 'failed',
    caption: "effectiveStatus: 'failed' — no confidence, because there is no verdict",
    hypothesis: InvestigationHypothesisFixture({
      status: 'failed',
      effectiveStatus: 'failed',
      confidence: null,
      agentVerdict: null,
    }),
  },
  {
    key: 'cancelled',
    caption: "effectiveStatus: 'cancelled' — stopped before it reached a verdict",
    hypothesis: InvestigationHypothesisFixture({
      status: 'cancelled',
      effectiveStatus: 'cancelled',
      confidence: null,
      agentVerdict: null,
    }),
  },
];

const USER_DECISIONS: StatusBoxRow[] = [
  {
    key: 'accepted-by-you',
    caption: "effectiveStatus: 'accepted', decisionSource: 'user'",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'accepted',
      decisionSource: 'user',
      confidence: null,
    }),
  },
  {
    key: 'rejected-by-you',
    caption: "effectiveStatus: 'rejected', decisionSource: 'user'",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'rejected',
      decisionSource: 'user',
      confidence: null,
    }),
  },
];

const IN_FLIGHT: StatusBoxRow[] = [
  {
    key: 'formed',
    caption: "effectiveStatus: 'pending', verificationSteps: [] — nothing planned yet",
    hypothesis: InvestigationHypothesisFixture({
      status: 'queued',
      effectiveStatus: 'pending',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [],
    }),
  },
  {
    key: 'preparing',
    caption: "status: 'queued' — the checks are planned, but none has started",
    hypothesis: InvestigationHypothesisFixture({
      status: 'queued',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({status: 'queued', result: null}),
      ],
    }),
  },
  {
    key: 'checking',
    caption: "status: 'running' — live work, and the only box that spins",
    hypothesis: InvestigationHypothesisFixture({
      status: 'running',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({status: 'running', result: null}),
        InvestigationVerificationStepFixture({
          id: 'step-2',
          order: 1,
          status: 'queued',
          result: null,
        }),
      ],
    }),
  },
  {
    key: 'evidence-checked',
    caption: 'every step has produced a result — only the verdict is missing',
    hypothesis: InvestigationHypothesisFixture({
      status: 'running',
      effectiveStatus: 'investigating',
      confidence: null,
      agentVerdict: null,
      verificationSteps: [
        InvestigationVerificationStepFixture({
          status: 'completed',
          result: 'Retries tripled while the p95 climbed.',
        }),
      ],
    }),
  },
];

const UNKNOWN: StatusBoxRow[] = [
  {
    key: 'unknown',
    caption: "effectiveStatus: 'needs_more_data' — humanized rather than dropped",
    hypothesis: InvestigationHypothesisFixture({
      effectiveStatus: 'needs_more_data',
      confidence: null,
      agentVerdict: null,
    }),
  },
];
