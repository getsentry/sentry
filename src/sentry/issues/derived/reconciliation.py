from collections.abc import Sequence
from typing import Any

from sentry.issues.action_log.types import (
    GroupActionType,
    _FeatureChange,
    _ReconcileFeaturesAction,
)
from sentry.issues.derived.features import LAST_PROGRESSED_AT, PROGRESS, STATUS
from sentry.issues.derived.framework import (
    AggregatorResult,
    Feature,
    FeatureEntry,
    StateView,
    emit,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry

# Features that have been validated for reconciliation. Each must be handled by
# an aggregator that includes RECONCILE_FEATURES in its scope and has tests
# covering the reconciliation path.
RECONCILABLE_FEATURES: frozenset[Feature[Any]] = frozenset({STATUS, PROGRESS, LAST_PROGRESSED_AT})


def reconcile_features(
    state: StateView, entry: GroupActionLogEntry, *features: Feature[Any]
) -> AggregatorResult:
    if entry.type != GroupActionType.RECONCILE_FEATURES:
        raise ValueError(f"Expected RECONCILE_FEATURES, got {entry.type}")
    for f in features:
        if f not in state:
            raise ValueError(f"Attempted to reconcile feature not found in state: {f.name}")
    # Trying to be efficient in no-op cases: check the raw dict before
    # constructing the Pydantic model.
    features_by_name = {f.name: f for f in features}
    raw_changes = entry.data.get("changes", ())
    if not any(ch["feature_name"] in features_by_name for ch in raw_changes):
        return None
    rec_action = _ReconcileFeaturesAction(**entry.data)
    changes: list[FeatureEntry] = []
    for ch in rec_action.changes:
        f = features_by_name.get(ch.feature_name)
        if f is not None:
            changes.append((f, f.load(ch.new_value)))
    return emit(*changes)


def create_reconciliation_action(updates: Sequence[FeatureEntry]) -> _ReconcileFeaturesAction:
    if len(updates) == 0:
        raise ValueError("Reconciliation actions can't be created with no updates")
    unsupported = {feat.name for feat, _ in updates if feat not in RECONCILABLE_FEATURES}
    if unsupported:
        raise ValueError(f"Features not supported for reconciliation: {unsupported}")
    return _ReconcileFeaturesAction(
        changes=[
            _FeatureChange(feature_name=feat.name, new_value=feat.dump(val))
            for feat, val in updates
        ]
    )
