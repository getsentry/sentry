# Frozen comparison runs

`preprod.snapshots.versioned-comparison-plans.enabled` defaults to `false`.
It selects protocol 2 only when creating a comparison row. Existing legacy
comparisons keep their protocol, including retries after the option changes.

The orchestrator uploads immutable assignments and a plan under a fresh execution
ID, then publishes that ID while locking the comparison row. Concurrent
orchestrators reuse the winning plan. Only after publication are workers
dispatched. A retry reads that plan instead of reloading manifests, selecting a
new approved sibling, or repacking completed chunks.

Workers read one assignment rather than the full plan. Plans capture thresholds,
the diff algorithm version, and approved-sibling fingerprints. Unsupported
algorithms fail closed rather than silently mixing evidence from different
versions. Completion and finalization writes require the published execution ID.
Finalization checks assignment identities, hashes, pixel counts, and thresholds
before accepting results; unreadable or inconsistent chunks become errored.

Masks use per-attempt paths, and each finalizer writes a separate report before
conditionally publishing its key. Losing or delayed attempts therefore cannot
overwrite the published report or its masks. Reports retain the existing schema
and image IDs remain relative to the organization/project storage prefix.

## Deployment and rollback

1. Deploy protocol-2-capable orchestrators, chunk workers, and finalizers
   everywhere before enabling the option. Old workers accept unknown kwargs and
   cannot safely interpret new executions.
2. Enable the option separately. Watch task duration, objectstore request rates,
   errored image counts, stuck comparisons, and automatic approvals. Per-chunk
   assignment objects add storage operations; publication is bounded to eight
   concurrent uploads.
3. Disable the option to stop creating new protocol-2 comparisons. Existing ones
   continue using their frozen plans, even if orchestration has not finished.
4. Drain all protocol-2 work and retries before rolling back to code without
   protocol-2 support. Retain the same diff algorithm implementation until its
   executions drain, or add explicit dispatch for older algorithm versions.

Unselected plans and unpublished attempt artifacts are not eagerly deleted;
they rely on the existing objectstore retention policy. A missing frozen plan is
an error, not permission to rebuild different assignments under the same ID.
This change does not stream image downloads, change mask encoding, parallelize
result reads, or introduce a pair-count batching limit.
