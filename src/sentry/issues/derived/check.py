import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, NamedTuple, TypedDict
from uuid import uuid4

from sentry.issues.derived.features import STATUS, IssueStatus
from sentry.issues.derived.framework import Feature, Pipeline
from sentry.issues.derived.gate import derived_should_be_correct
from sentry.issues.derived.processing import DEFAULT_BATCH_SIZE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.workflow_engine.caches.mapping import CacheMapping

logger = logging.getLogger(__name__)

_GROUP_STATUS_TO_DERIVED_STATUS = {
    GroupStatus.UNRESOLVED: IssueStatus.OPEN,
    GroupStatus.RESOLVED: IssueStatus.CLOSED,
    GroupStatus.IGNORED: IssueStatus.CLOSED,
}
# Lifecycle-only statuses such as pending deletion and reprocessing have no
# equivalent in the derived OPEN/CLOSED model and are intentionally omitted.


@dataclass(frozen=True)
class StatusInconsistency:
    derived: IssueStatus
    actual: IssueStatus


def check_status_consistency(group: Group, derived: GroupDerivedData) -> StatusInconsistency | None:
    """Compare a group's source-of-truth status with its derived status."""
    actual_status = _GROUP_STATUS_TO_DERIVED_STATUS.get(group.status)
    if actual_status is None:
        return None

    raw = derived.data.get(STATUS.name)
    derived_status = STATUS.from_json(raw) if raw is not None else STATUS.initial_value()
    if derived_status == actual_status:
        return None

    return StatusInconsistency(derived=derived_status, actual=actual_status)


def record_status_consistency(
    group: Group, derived: GroupDerivedData, *, source: str
) -> StatusInconsistency | None:
    """Record a metric/log for a status consistency check.

    Returns the inconsistency when one is found, otherwise ``None``.
    """
    inconsistency = check_status_consistency(group, derived)
    if inconsistency is None:
        metrics.incr(
            "issues.status_reconciliation.checked",
            sample_rate=1.0,
            tags={"result": "aligned", "source": source},
        )
        return None

    metrics.incr(
        "issues.status_reconciliation.checked",
        sample_rate=1.0,
        tags={
            "result": "diverged",
            "derived_status": inconsistency.derived.value,
            "actual_status": inconsistency.actual.value,
            "source": source,
        },
    )
    logger.info(
        "issues.status_reconciliation.diverged",
        extra={
            "group_id": group.id,
            "project_id": group.project_id,
            "derived_status": inconsistency.derived.value,
            "actual_status": inconsistency.actual.value,
            "source": source,
        },
    )
    return inconsistency


def record_batch_status_consistency(
    derived: GroupDerivedData,
    group: Group,
    project_should_check: dict[int, bool],
) -> None:
    """Observe status consistency for one derived row during a batch check."""
    project_id = group.project_id
    if project_id not in project_should_check:
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            project_should_check[project_id] = False
        else:
            project_should_check[project_id] = derived_should_be_correct(project)
    if not project_should_check[project_id]:
        return
    try:
        record_status_consistency(group, derived, source="batch_check")
    except Exception:
        logger.exception(
            "check_fresh_derived_data_batch.status_consistency_failed",
            extra={"group_id": derived.group_id, "project_id": project_id},
        )
        metrics.incr(
            "issues.status_reconciliation.error",
            sample_rate=1.0,
            tags={"source": "batch_check"},
        )


@dataclass(frozen=True)
class CheckPassed:
    """A check that found no differences."""

    pass


@dataclass(frozen=True)
class CheckInvalidated:
    """A check invalidated by changes to its target."""

    pass


class FeatureDifference(TypedDict):
    """JSON-safe expected and actual feature values for diagnostics."""

    expected: object
    actual: object


@dataclass(frozen=True)
class CheckFailure:
    """Feature differences found by a completed check."""

    group_id: int
    cursor_date: datetime
    cursor_id: int
    differences: dict[Feature[Any], FeatureDifference]


type CheckResult = CheckPassed | CheckFailure | CheckInvalidated


def compare_derived_data(
    pipeline: Pipeline[GroupActionLogEntry],
    expected: GroupDerivedData,
    actual: GroupDerivedData,
) -> dict[Feature[Any], FeatureDifference]:
    """Compare two derived-data values using a pipeline's features."""
    expected_state = GroupDerivedDataStore.load(pipeline, expected)
    actual_state = GroupDerivedDataStore.load(pipeline, actual)
    return {
        feature: FeatureDifference(
            expected=feature.to_json(expected_state[feature]),
            actual=feature.to_json(actual_state[feature]),
        )
        for feature in pipeline.features
        if expected_state[feature] != actual_state[feature]
    }


class CheckId(NamedTuple):
    """The immutable identity and target of a resumable check."""

    invocation_id: str
    group_id: int
    generated_at: datetime
    cursor_date: datetime
    cursor_id: int
    pipeline_hash: str

    @classmethod
    def new_for_derived_data(cls, target: GroupDerivedData) -> "CheckId":
        """Create an ID for a new check of the target."""
        assert target.pipeline_hash is not None
        return cls(
            uuid4().hex,
            target.group_id,
            target.generated_at,
            target.cursor_date,
            target.cursor_id,
            target.pipeline_hash,
        )

    def matches(self, target: GroupDerivedData) -> bool:
        """Return whether the target still matches this check."""
        return (
            self.group_id == target.group_id
            and self.generated_at == target.generated_at
            and self.cursor_date == target.cursor_date
            and self.cursor_id == target.cursor_id
            and self.pipeline_hash == target.pipeline_hash
        )


_check_cache = CacheMapping[CheckId, GroupDerivedData](
    lambda key: (
        f"{key.invocation_id}:{key.group_id}:{key.generated_at.isoformat()}:"
        f"{key.cursor_date.isoformat()}:{key.cursor_id}:{key.pipeline_hash}"
    ),
    namespace="gdd-check",
    ttl_seconds=86400,
)


class CheckTimeout(Exception):
    """A resumable check exceeded its time limit."""

    def __init__(self, check_id: CheckId) -> None:
        self.check_id = check_id
        super().__init__(check_id)


def _entries_through_target_cursor(
    replayed: GroupDerivedData, target: CheckId, batch_size: int
) -> list[GroupActionLogEntry]:
    assert replayed.group_id == target.group_id
    return list(
        GroupActionLogEntry.objects.filter(group_id=target.group_id)
        .extra(
            where=[
                'ROW("date_added", "id") > ROW(%s, %s)',
                'ROW("date_added", "id") <= ROW(%s, %s)',
            ],
            params=[
                replayed.cursor_date,
                replayed.cursor_id,
                target.cursor_date,
                target.cursor_id,
            ],
        )
        .order_by("date_added", "id")[:batch_size]
    )


def check_derived_data(
    target: GroupDerivedData,
    pipeline: Pipeline[GroupActionLogEntry],
    timeout: timedelta | None = None,
    *,
    check_id: CheckId | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> CheckResult:
    """Replay and compare the derived data for a target."""
    if target.pipeline_hash != pipeline.pipeline_hash:
        return CheckInvalidated()

    if check_id is not None:
        if not check_id.matches(target):
            _check_cache.delete(check_id)
            return CheckInvalidated()
    else:
        check_id = CheckId.new_for_derived_data(target)

    replayed_derived = _check_cache.get(check_id)
    if replayed_derived is None:
        replayed_derived = GroupDerivedData(
            group_id=target.group_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=target.pipeline_hash,
        )

    deadline = time.monotonic() + timeout.total_seconds() if timeout is not None else None
    while entries := _entries_through_target_cursor(replayed_derived, check_id, batch_size):
        replayed = pipeline.run(
            entries, state=GroupDerivedDataStore.load(pipeline, replayed_derived)
        )
        GroupDerivedDataStore.apply_to_instance(
            replayed_derived, GroupDerivedDataStore.build_update(pipeline, replayed)
        )
        replayed_derived.cursor_date = entries[-1].date_added
        replayed_derived.cursor_id = entries[-1].id
        if len(entries) < batch_size:
            break
        if deadline is not None and time.monotonic() >= deadline:
            _check_cache.set(check_id, replayed_derived)
            raise CheckTimeout(check_id)

    current = GroupDerivedData.objects.get_or_none(group_id=check_id.group_id)
    if current is None or not check_id.matches(current):
        _check_cache.delete(check_id)
        return CheckInvalidated()

    differences = compare_derived_data(pipeline, replayed_derived, target)
    _check_cache.delete(check_id)
    if not differences:
        return CheckPassed()

    return CheckFailure(
        group_id=target.group_id,
        cursor_date=target.cursor_date,
        cursor_id=target.cursor_id,
        differences=differences,
    )
