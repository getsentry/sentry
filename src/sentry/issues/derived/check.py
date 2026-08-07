import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import NamedTuple
from uuid import uuid4

from sentry.issues.derived.framework import Pipeline
from sentry.issues.derived.processing import DEFAULT_BATCH_SIZE
from sentry.issues.derived.store import GroupDerivedDataStore
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import EPOCH, GroupDerivedData
from sentry.workflow_engine.caches.mapping import CacheMapping


@dataclass(frozen=True)
class CheckPassed:
    pass


@dataclass(frozen=True)
class CheckInvalidated:
    pass


@dataclass(frozen=True)
class CheckFailure:
    group_id: int
    cursor_date: datetime
    cursor_id: int
    features: frozenset[str]


type CheckResult = CheckPassed | CheckFailure | CheckInvalidated


class CheckId(NamedTuple):
    invocation_id: str
    group_id: int
    generated_at: datetime
    cursor_date: datetime
    cursor_id: int
    pipeline_hash: str

    @classmethod
    def new_for_derived_data(cls, target: GroupDerivedData) -> "CheckId":
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
    pipeline: Pipeline,
    timeout: timedelta | None = None,
    *,
    check_id: CheckId | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> CheckResult:
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

    current = GroupDerivedData.objects.filter(group_id=check_id.group_id).first()
    if current is None or not check_id.matches(current):
        _check_cache.delete(check_id)
        return CheckInvalidated()

    replayed = GroupDerivedDataStore.load(pipeline, replayed_derived)
    stored = GroupDerivedDataStore.load(pipeline, target)
    features = replayed.features | stored.features | frozenset(pipeline.features)
    different_features = frozenset(
        feature.name
        for feature in features
        if feature not in replayed or feature not in stored or replayed[feature] != stored[feature]
    )
    _check_cache.delete(check_id)
    if not different_features:
        return CheckPassed()

    return CheckFailure(
        group_id=target.group_id,
        cursor_date=target.cursor_date,
        cursor_id=target.cursor_id,
        features=different_features,
    )
