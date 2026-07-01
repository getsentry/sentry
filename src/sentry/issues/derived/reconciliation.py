from typing import Any

from sentry.issues.action_log.types import GroupActionType, _ReconcileFeatureAction
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
    target_name = entry.data.get("feature_name")
    match = next((f for f in features if f.name == target_name), None)
    if match is None:
        return None
    action = _ReconcileFeatureAction(**entry.data)
    return emit((match, match.load(action.new_value)))


def create_reconciliation_action(update: FeatureEntry) -> _ReconcileFeatureAction:
    feat, val = update
    if feat not in RECONCILABLE_FEATURES:
        raise ValueError(f"Feature not supported for reconciliation: {feat.name}")
    return _ReconcileFeatureAction(
        feature_name=feat.name,
        new_value=feat.dump(val),
    )
