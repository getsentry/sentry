import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import NamedTuple
from uuid import uuid4

from sentry.issues.derived.processing import DEFAULT_BATCH_SIZE, PIPELINE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.workflow_engine.caches.mapping import CacheMapping


class CheckSuccess(Enum):
    OK = "ok"


@dataclass(frozen=True)
class CheckFailure:
    group_id: int
    cursor_date: datetime
    cursor_id: int
    features: frozenset[str]


type CheckResult = CheckSuccess | CheckFailure


class CheckId(NamedTuple):
    invocation_id: str
    group_id: int
    generated_at: datetime
    cursor_date: datetime
    cursor_id: int
    pipeline_hash: str


_check_cache = CacheMapping[CheckId, GroupDerivedData](
    lambda key: (
        f"{key.invocation_id}:{key.group_id}:{key.generated_at.isoformat()}:"
        f"{key.cursor_date.isoformat()}:{key.cursor_id}:{key.pipeline_hash}"
    ),
    namespace="gdd-check",
    ttl_seconds=86400,
)


class CheckTimeout(Exception):
    def __init__(self, check_id: CheckId) -> None:
        self.check_id = check_id
        super().__init__(check_id)


def _entries_after_cursor(
    derived: GroupDerivedData, target: CheckId, batch_size: int
) -> list[GroupActionLogEntry]:
    return list(
        GroupActionLogEntry.objects.filter(group_id=target.group_id)
        .extra(
            where=[
                'ROW("date_added", "id") > ROW(%s, %s)',
                'ROW("date_added", "id") <= ROW(%s, %s)',
            ],
            params=[
                derived.cursor_date,
                derived.cursor_id,
                target.cursor_date,
                target.cursor_id,
            ],
        )
        .order_by("date_added", "id")[:batch_size]
    )


def check_derived_data(
    derived: GroupDerivedData,
    timeout: timedelta | None = None,
    *,
    check_id: CheckId | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> CheckResult | None:
    if derived.pipeline_hash != PIPELINE.pipeline_hash:
        return None

    target_fields = (
        derived.group_id,
        derived.generated_at,
        derived.cursor_date,
        derived.cursor_id,
        derived.pipeline_hash,
    )
    if check_id is not None:
        if check_id[1:] != target_fields:
            _check_cache.delete(check_id)
            return None
        target = check_id
    else:
        target = CheckId(uuid4().hex, *target_fields)

    replayed_derived = _check_cache.get(target) if check_id is not None else None
    if replayed_derived is None:
        replayed_derived = GroupDerivedData(
            group_id=derived.group_id,
            cursor_date=EPOCH,
            cursor_id=0,
            data={},
            pipeline_hash=derived.pipeline_hash,
        )

    deadline = time.monotonic() + timeout.total_seconds() if timeout is not None else None
    while entries := _entries_after_cursor(replayed_derived, target, batch_size):
        replayed = PIPELINE.run(
            entries, state=GroupDerivedDataStore.load(PIPELINE, replayed_derived)
        )
        GroupDerivedDataStore.apply_to_instance(
            replayed_derived, GroupDerivedDataStore.build_update(PIPELINE, replayed)
        )
        replayed_derived.cursor_date = entries[-1].date_added
        replayed_derived.cursor_id = entries[-1].id
        if len(entries) < batch_size:
            break
        if deadline is not None and time.monotonic() >= deadline:
            _check_cache.set(target, replayed_derived)
            raise CheckTimeout(target)

    current = (
        GroupDerivedData.objects.filter(group_id=target.group_id)
        .values_list("generated_at", "cursor_date", "cursor_id", "pipeline_hash")
        .first()
    )
    if current != (
        target.generated_at,
        target.cursor_date,
        target.cursor_id,
        target.pipeline_hash,
    ):
        _check_cache.delete(target)
        return None

    replayed = GroupDerivedDataStore.load(PIPELINE, replayed_derived)
    stored = GroupDerivedDataStore.load(PIPELINE, derived)
    different_features = frozenset(
        feature.name for feature in PIPELINE.features if replayed[feature] != stored[feature]
    )
    _check_cache.delete(target)
    if not different_features:
        return CheckSuccess.OK

    return CheckFailure(
        group_id=derived.group_id,
        cursor_date=derived.cursor_date,
        cursor_id=derived.cursor_id,
        features=different_features,
    )
