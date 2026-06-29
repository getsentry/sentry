"""
Storage translation between Pipeline state and GroupDerivedData.

Handles loading state from a GroupDerivedData instance and producing
update kwargs to persist state back. This is the layer that knows
about the storage layout (JSON blob vs columns) so the Pipeline
and Features don't have to.
"""

from typing import Any

from sentry.issues.derived.features import LAST_PROGRESSED_AT, PROGRESS, VIEW_COUNT
from sentry.issues.derived.framework import Feature, Pipeline, State
from sentry.issues.models.groupderiveddata import GroupDerivedData

# Features whose values are stored in dedicated model columns rather than
# the JSON blob. Keyed by Feature object, value is the column name on
# GroupDerivedData. Features not listed here live in the `data` JSON field.
COLUMN_MAP: dict[Feature[Any], str] = {
    VIEW_COUNT: "view_count",
    PROGRESS: "progress",
    LAST_PROGRESSED_AT: "last_progressed_at",
}


class GroupDerivedDataStore:
    """Translates between Pipeline State and GroupDerivedData storage.

    Features listed in COLUMN_MAP are read from / written to dedicated
    model columns. All other features use the `data` JSON blob.
    """

    @staticmethod
    def load(pipeline: Pipeline[Any], derived: GroupDerivedData) -> State:
        data: dict[str, Any] = derived.data
        result: dict[Feature[Any], Any] = {}
        for f in pipeline.features:
            column = COLUMN_MAP.get(f)
            if column:
                result[f] = f.load(getattr(derived, column))
            elif f.name in data:
                result[f] = f.load(data[f.name])
            else:
                result[f] = f.initial_value()
        return State(result)

    @staticmethod
    def build_update(pipeline: Pipeline[Any], state: State) -> dict[str, Any]:
        """Build a dict of model fields to persist.

        Only includes columns and JSON-blob data that aggregators actually
        updated.
        """
        updated = state.updated
        json_features = [f for f in pipeline.features if f not in COLUMN_MAP]

        update: dict[str, Any] = {}
        for f in pipeline.features:
            column = COLUMN_MAP.get(f)
            if column and f in updated:
                update[column] = f.dump(state[f])
        # If any JSON feature was updated, include all of them (the blob is replaced wholesale)
        if updated.intersection(json_features):
            update["data"] = {f.name: f.dump(state[f]) for f in json_features}
        return update

    @staticmethod
    def apply_to_instance(derived: GroupDerivedData, update: dict[str, Any]) -> None:
        for key, val in update.items():
            setattr(derived, key, val)
