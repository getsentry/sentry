# Night Shift triage code-mode experiment

Sentry owns enrollment, assignment, and the saved dispatch request. Seer already
implements both triage modes and receives an explicit
`agent_run_options.enable_code_mode_tools`: `off` for control, `only` for code
mode. Seer enforces read-only code mode for Night Shift. Downstream Autofix runs
are outside this experiment.

## Activation

After all Sentry workers have deployed, enable the FlagPole feature
`organizations:seer-night-shift-code-mode-experiment` only for the intended
organization in the appropriate cell. Configuration lives in
`sentry-options-automator/options/default/flagpole.yaml`.

All new triage shards in flagged orgs enter the experiment, split approximately
50/50 between `control` and `code_mode`.
Unflagged orgs keep their existing behavior.

Wait for deployment to finish before enabling it: older workers can read the
additive shard-plan format but do not apply the experiment field.

## Assignment and retries

Assignment uses a salted hash of workflow run ID and shard index, so shards
within one org can receive different arms.

The arm is saved as `code_mode_experiment_arm` in
`SeerWorkflowRunExecution.extras` under the existing workflow-run lock, before
any dispatch. Retries reuse that plan, even if the flag changes.
Historical plans without the field remain unenrolled. The outgoing mode is then
persisted by the existing `SEER_RUN_CREATE` outbox, so outbox retries also retain
the same mode and idempotency key. This applies to new scheduled and manual
Night Shift runs.

## Measurement and stopping

The same arm is copied into `SeerAgentRun.extras` when dispatch creates the
agent-run mirror. Join the workflow execution to its `seer_run` for dispatched
run IDs and to its Night Shift results for downstream outcomes. Missing arm
means unenrolled; exclude those rows from the randomized comparison. Failed or
undispatched enrolled shards remain attributable through execution extras.

Compare completion/error rate, latency, cost, and triage verdict distribution by
arm. Review sampled verdicts and downstream outcomes to assess quality; a higher
autofix rate alone is not evidence of improvement. Seer's existing
`agent_run_options.enable_code_mode_tools` trace tag records the actual tool
mode, and its existing prompt-version attribution identifies the prompt used.

The unit of randomization is a shard: issues within a shard share an arm and are
not independent samples. Account for repeated issues and organization/night
effects in analysis. This is a live experiment; Sentry executes the selected
arm's verdicts normally, rather than running both arms on the same batch.

Disable the feature for an org to stop new enrollment.
Already-planned shards and queued outbox requests retain their saved assignment.
