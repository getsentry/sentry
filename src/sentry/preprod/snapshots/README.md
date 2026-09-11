# Snapshot comparison

The pipeline answers two different questions with the same image-comparison
executor:

1. What changed between the head snapshot and its complete base?
2. Can the head inherit a human-approved sibling's approval?

```text
resolve uploads and reconstruct the base
                  |
plan snapshot changes + potential approval measurements
                  |
dispatch bounded chunks of image pairs
                  |
assemble the snapshot report + decide approval
                  |
persist completion, then notify VCS
```

## Ownership

| Module              | Responsibility                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `tasks.py`          | Stable broker task registrations and scheduling adapters                       |
| `workflow.py`       | Claim, publish, dispatch, resume, collect, and complete                        |
| `comparison.py`     | Snapshot planning, threshold decisions, report assembly, and result projection |
| `approval.py`       | Human-approved sibling selection, evidence planning, and approval decisions    |
| `execution.py`      | Bounded downloads, header verification, and image-pair measurements            |
| `storage.py`        | Object keys, serialization, retries, and per-execution storage                 |
| `categorize.py`     | Filename classification and rename matching                                    |
| `reconstruction.py` | Resolve selective ancestry into a complete base                                |
| `image_diff/`       | Padding, odiff protocol, mask-based pixel counting, and image cleanup          |

`execution.py` knows neither snapshot statuses nor approval policy. It measures
ordered `ImagePair` requests and returns `DiffResult` or `ImageDiffFailure`.
`comparison.py` applies each candidate's threshold and projects these outcomes
into the existing wire format. Request position, not filename, identifies a
measurement, so a filename can have both base and sibling measurements.

Approval planning is speculative: a hash-different head/base pair might finish
as unchanged. Approval is decided only after the report is assembled. It requires
matching relevant filenames, statuses, and rename origins; every differing hash
must have matching, within-threshold sibling evidence. Unchanged and skipped
entries are excluded from the fingerprints. Auto-approved builds are not anchors.

## Execution protocol

Legacy tasks keep master-plan input and the legacy batching rules. New plans use
version 2 when `preprod.snapshots.versioned-comparison-plans.enabled` is on.
The option defaults to off.

Version 2 publishes a plan as follows:

1. Write assignments and the master plan under a unique execution prefix.
2. Lock the comparison row briefly and publish the execution ID in
   `extras.snapshot_execution_id`. A competing publisher uses the winning plan.
3. Dispatch unfinished assignments. Each worker reads only its assignment, not
   the master plan or other images' results.
4. Record `chunks_total` after dispatch completes, then check for finalization.

The master plan freezes the chosen base contents, thresholds, algorithm version,
and approval fingerprints. A retry loads it rather than selecting another sibling
or rebuilding ancestry. A deliberate recompare creates a new comparison row and
execution identity. Worker completion and finalization are fenced by that identity.

The master plan remains available to finalization so missing or corrupt assignments
and results can be represented as errors for the correct images. Results are read
in bounded parallel groups and merged in plan order. Version 2 checks that each
result covers its assignment and names the expected hashes.

Version 2 report uploads have unique keys; only the winning conditional database
update publishes its report pointer. Diff-mask keys also include the execution,
worker attempt, and request index, avoiding filename-stem collisions.

## Failure rules

- A caught chunk failure is terminal and still records completion. Missing results
  become errored images; they do not prevent assembling the rest of the report.
- Deadline interruptions propagate for broker recovery. Completion is recorded
  only after a result write or a caught terminal failure.
- `chunks_total = NULL` means dispatch has not finished. Setting it before dispatch
  would prevent recovery of an interrupted orchestrator.
- Both chunks and the orchestrator check completion. This covers empty plans and
  chunks that finish before dispatch is sealed.
- Progress timestamps are updated for newly completed chunks and before assembly.
  The existing expiration task remains the recovery backstop.
- `SUCCESS` means the report was assembled, not that there were no differences or
  errors. Approval, analytics, and VCS scheduling remain best-effort after the
  guarded success transition; this is not exactly-once side-effect delivery.

## Resource limits

Planning estimates the aligned canvas as `max(width) * max(height)`. Workers verify
headers and enforce per-pair and cumulative 40-million-pixel limits before decoding
or padding. Version 2 also limits chunks to 100 pairs so tiny images cannot create
an unbounded number of operations in one task.

Downloads are deduplicated by content hash within a chunk and use eight concurrent
fetchers. Encoded images are streamed to temporary files in 1 MiB reads instead of
being retained together in memory. The temporary directory is removed on exit.
Approval-only comparisons keep mask-based pixel counting but skip PNG mask encoding
and uploading. Assignment writes and result reads have at most eight requests in
flight per orchestrator/finalizer.

## Rollout and rollback

Deploy the readers and task implementations everywhere before enabling the
versioned-plan option. It is independent of the sibling-diff option. Older workers
do not understand execution IDs or per-assignment input keys.

Disabling the option stops creating new versioned executions; existing executions
continue using their frozen plans. Before rolling back to code without version 2
support, disable the option and drain in-flight versioned tasks and retries. Do not
relabel a versioned execution as legacy or rebuild its chunks under new settings.

The refactor does not require a database migration or a frontend deployment.

## Validation

```bash
.venv/bin/pytest -q --reuse-db tests/sentry/preprod/snapshots
```

The tests cover legacy and versioned execution, retry and recompare isolation,
approval fingerprints, malformed results, out-of-order completion, streaming
downloads, pixel limits, and counts-only equivalence with the existing image diff.
