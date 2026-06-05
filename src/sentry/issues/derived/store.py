"""
Storage translation between Pipeline state and GroupDerivedData.

Handles loading state from a GroupDerivedData instance and producing
update kwargs to persist state back. This is the layer that knows
about the storage layout (JSON blob vs columns) so the Pipeline
and Features don't have to.
"""

from typing import Any

from sentry.issues.derived.fields import LAST_SEEN, VIEW_COUNT
from sentry.issues.derived.lib import Feature, Pipeline, State
from sentry.models.groupderiveddata import GroupDerivedData

# Features whose values are stored in dedicated model columns rather than
# the JSON blob. Keyed by Feature object, value is the column name on
# GroupDerivedData. Features not listed here live in the `data` JSON field.
COLUMN_MAP: dict[Feature[Any], str] = {
    LAST_SEEN: "last_seen",
    VIEW_COUNT: "view_count",
}


class GroupDerivedDataStore:
    """Translates between Pipeline State and GroupDerivedData storage.

    Features listed in COLUMN_MAP are read from / written to dedicated
    model columns. All other features use the `data` JSON blob.
    """

    @staticmethod
    def load(pipeline: Pipeline, derived: GroupDerivedData) -> State:
        data: dict[str, Any] = derived.data
        result: dict[Feature[Any], Any] = {}
        for f in pipeline.fields:
            column = COLUMN_MAP.get(f)
            if column:
                result[f] = f.load(getattr(derived, column))
            elif f.name in data:
                result[f] = f.load(data[f.name])
            else:
                result[f] = f.initial_value()
        return State(result)

    @staticmethod
    def build_update(pipeline: Pipeline, state: State) -> dict[str, Any]:
        fields_by_name = {f.name: f for f in pipeline.fields}
        json_data: dict[str, Any] = {}
        update: dict[str, Any] = {}
        for name, val in state.items():
            f = fields_by_name[name]
            column = COLUMN_MAP.get(f)
            if column:
                update[column] = f.dump(val)
            else:
                json_data[name] = f.dump(val)
        update["data"] = json_data
        return update

    @staticmethod
    def apply_to_instance(derived: GroupDerivedData, update: dict[str, Any]) -> None:
        for key, val in update.items():
            setattr(derived, key, val)
