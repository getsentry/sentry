import {t, tn} from 'sentry/locale';
import type {SeerStatusBlockVariant} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

type SeerStatusBlockContent = {
  statusLabel: string;
  title: string;
  variant: SeerStatusBlockVariant;
  description?: string;
  meta?: string;
};

/**
 * How many checks have produced something across every hypothesis.
 *
 * A step counts as done once it has a result *or* an error — a check that broke
 * still ran, and the tally is "how much work stands behind this", not "how much
 * of it succeeded".
 */
function countCompletedChecks(projection: InvestigationOrchestration): number {
  return projection.hypotheses.reduce(
    (total, hypothesis) =>
      total +
      (hypothesis.verificationSteps ?? []).filter(step => step.result || step.error)
        .length,
    0
  );
}

/**
 * The tally under a finished or finishing run: how many explanations were
 * weighed, and how much checking stands behind them.
 *
 * Absent until there is something to count, which is why the early running
 * states render without it rather than claiming "0 possible causes".
 */
function getMeta(projection: InvestigationOrchestration): string | undefined {
  const causeCount = projection.hypotheses.length;
  if (causeCount === 0) {
    return undefined;
  }
  const checkCount = countCompletedChecks(projection);
  // Each half is translated; the bullet between them is punctuation, not a
  // string a translator has anything to do with.
  return [
    tn('%s possible cause', '%s possible causes', causeCount),
    tn('%s check completed', '%s checks completed', checkCount),
  ].join(' • ');
}

/**
 * The first error worth showing. The run-level list is the more specific of the
 * two — `report.error` is whatever stopped the write-up, which is only the
 * reason the run failed if nothing earlier did.
 */
function getFailureMessage(projection: InvestigationOrchestration): string | undefined {
  return projection.errors[0]?.message ?? projection.report.error?.message ?? undefined;
}

/**
 * What the status block should say for a run that is still moving.
 *
 * The phase is the only thing that separates these: `status` is `processing`
 * for all of them. They are all the same `running` variant — the agent is
 * working and the viewer has nothing to do — so only the words change.
 */
function getRunningContent(
  projection: InvestigationOrchestration
): SeerStatusBlockContent {
  const causeCount = projection.hypotheses.length;

  switch (projection.phase) {
    case 'intake':
    case 'broad_scan':
      return {
        variant: 'running',
        title: t('Seer is gathering context'),
        description: t(
          'Comparing the signals around the problem to work out where to look. No input needed.'
        ),
        statusLabel: t('Running…'),
      };
    case 'planning':
      return {
        variant: 'running',
        title: t('Seer is looking for likely causes'),
        description: t(
          'Possible causes will appear here as Seer connects the evidence. No input needed.'
        ),
        statusLabel: t('Running…'),
      };
    case 'investigating':
    case 'judging':
      return {
        variant: 'running',
        // Before the hypotheses land there is no count to quote, and "found 0
        // possible causes" is worse than not saying it.
        title: causeCount
          ? tn(
              'Seer found %s possible cause and is checking for evidence',
              'Seer found %s possible causes and is checking for evidence',
              causeCount
            )
          : t('Seer is checking for evidence'),
        description: t(
          'Seer is checking for evidence to validate each possible cause. No input needed.'
        ),
        statusLabel: t('Running…'),
      };
    // The hypotheses are settled and the write-up is being assembled. Still the
    // running variant, but the chip says so — this is the part that ends with
    // the page changing under the viewer.
    case 'reporting':
    case 'metadata':
      return {
        variant: 'running',
        title: t('Seer is bringing the findings together'),
        meta: getMeta(projection),
        description: t(
          'Organizing the explanation, supporting evidence, and next steps. Your investigation will open automatically.'
        ),
        statusLabel: t('Finalizing…'),
      };
    default:
      return {
        variant: 'running',
        title: t('Seer is investigating'),
        statusLabel: t('Running…'),
      };
  }
}

/**
 * The status block's content for a run, or `null` when there is nothing to say.
 *
 * `status` decides the variant and `phase` decides the words, which is why this
 * reads both: every in-flight phase shares one `processing` status, and every
 * stopped run shares the `completed`/`failed`/`cancelled` phases with its
 * status. Taking the variant from the status keeps the colour tied to whether
 * the viewer has to do anything.
 */
export function getSeerStatusBlock(
  projection: InvestigationOrchestration
): SeerStatusBlockContent | null {
  switch (projection.status) {
    // Stopped, but recoverably, and the only state that asks for something
    // back. The agent's own prompt is far more specific than anything that
    // could be written here, so it wins when present.
    case 'awaiting_input':
      return {
        variant: 'awaitingInput',
        title: t('Seer needs more information to continue'),
        description:
          projection.pendingInput?.prompt ||
          t('Seer is waiting on input before it can carry on.'),
        statusLabel: t('Awaiting input'),
      };
    case 'failed':
      return {
        variant: 'failed',
        title: t("Seer couldn't finish this investigation"),
        description:
          getFailureMessage(projection) ??
          t('Checks that had already finished are saved.'),
        statusLabel: t('Failed'),
      };
    case 'cancelled':
      return {
        variant: 'cancelled',
        title: t('This investigation was stopped'),
        description: t('Checks that had already finished are saved.'),
        statusLabel: t('Cancelled'),
      };
    case 'completed':
      return {
        variant: 'complete',
        title: t('Your investigation is ready'),
        meta: getMeta(projection),
        description: t(
          'Findings, supporting evidence, and recommended next steps are ready.'
        ),
        statusLabel: t('Complete'),
      };
    case 'pending':
    case 'processing':
      return getRunningContent(projection);
    default:
      // An unrecognized status is still a run in progress as far as the viewer
      // is concerned — Seer can add one before this code knows the name, and a
      // missing block reads as "nothing is happening", which is worse.
      return getRunningContent(projection);
  }
}
