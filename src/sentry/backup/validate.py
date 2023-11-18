from __future__ import annotations

from collections import OrderedDict as ordereddict
from collections import defaultdict
from copy import deepcopy
from difflib import unified_diff
from typing import Dict, OrderedDict, Tuple

from sentry.backup.comparators import ComparatorMap, ForeignKeyComparator, get_default_comparators
from sentry.backup.dependencies import ImportKind, NormalizedModelName, PrimaryKeyMap, get_model
from sentry.backup.findings import (
    ComparatorFinding,
    ComparatorFindingKind,
    ComparatorFindings,
    InstanceID,
)
from sentry.backup.helpers import Side
from sentry.utils.json import JSONData, JSONEncoder, better_default_encoder

JSON_PRETTY_PRINTER = JSONEncoder(
    default=better_default_encoder, indent=2, ignore_nan=True, sort_keys=True
)


def validate(
    expect: JSONData,
    actual: JSONData,
    comparators: ComparatorMap | None = None,
) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a
    list of reasons why not when it doesn't.
    """

    class OrdinalCounter:
        """Keeps track of the next ordinal to be assigned for a given model kind."""

        # The `value` being tracked is either the custom ordering tuple for this model (see: `BaseModel::get_relocation_ordinal_fields()` method), or otherwise just the pk.
        max_seen_ordinal_value: int | tuple | None
        next_ordinal: int

        def __init__(self):
            self.max_seen_ordinal_value = None
            self.next_ordinal = 1

        def assign(
            self, obj: JSONData, ordinal_value: int | tuple, side: Side
        ) -> Tuple[InstanceID, list[ComparatorFinding]]:
            """Assigns the next available ordinal to the supplied `obj` model."""

            pk = obj["pk"]
            model_name = NormalizedModelName(obj["model"])
            findings = []
            if (
                self.max_seen_ordinal_value is None
                or ordinal_value > self.max_seen_ordinal_value  # type: ignore
            ):
                self.max_seen_ordinal_value = ordinal_value
            else:
                # Only `pk`-based collisions are reported here; collisions for custom ordinals are
                # caught earlier.
                assert not isinstance(self.max_seen_ordinal_value, tuple)

                findings.append(
                    ComparatorFinding(
                        kind=ComparatorFindingKind.UnorderedInput,
                        on=InstanceID(str(model_name), self.next_ordinal),
                        left_pk=pk if side == Side.left else None,
                        right_pk=pk if side == Side.right else None,
                        reason=f"""instances not listed in ascending `pk` order; `pk` {pk} is less than or equal to {self.max_seen_ordinal_value} which precedes it""",
                    )
                )

            obj["ordinal"] = self.next_ordinal
            self.next_ordinal += 1

            return (InstanceID(str(model_name), obj["ordinal"]), findings if findings else [])

    OrdinalCounters = Dict[NormalizedModelName, OrdinalCounter]
    ModelMap = Dict[NormalizedModelName, OrderedDict[InstanceID, JSONData]]

    def build_model_map(
        models: JSONData, side: Side, findings: ComparatorFindings
    ) -> Tuple[ModelMap, OrdinalCounters]:
        """Does two things in tandem: builds a map of InstanceID -> JSON model, and simultaneously builds a map of model name -> number of ordinals assigned."""

        from sentry.db.models import BaseModel
        from sentry.models.user import User

        model_map: ModelMap = defaultdict(ordereddict)
        ordinal_counters: OrdinalCounters = defaultdict(OrdinalCounter)
        need_ordering: dict[NormalizedModelName, Dict[tuple, JSONData]] = defaultdict(dict)
        pks_to_usernames: dict[int, str] = dict()

        for model in models:
            pk = model["pk"]
            model_name = NormalizedModelName(model["model"])
            model_type = get_model(model_name)
            if model_type is None or not issubclass(model_type, BaseModel):
                raise RuntimeError("Unknown model class")

            if model_type == User:
                pks_to_usernames[pk] = model["fields"]["username"]

            custom_ordinal_fields = model_type.get_relocation_ordinal_fields()
            if custom_ordinal_fields is None:
                id, found = ordinal_counters[model_name].assign(model, pk, side)
                findings.extend(found)
                model_map[model_name][id] = model
                continue

            custom_ordinal_parts = []
            for field in custom_ordinal_fields:
                # Special case: for `user` pks, look through the user to the `username` instead.
                if field == "user" or field == "user_id":
                    custom_ordinal_parts.append(pks_to_usernames[model["fields"][field]])
                else:
                    custom_ordinal_parts.append(model["fields"][field])

            ordinal = tuple(custom_ordinal_parts)
            if need_ordering[model_name].get(ordinal) is not None:
                findings.append(
                    ComparatorFinding(
                        kind=ComparatorFindingKind.DuplicateCustomOrdinal,
                        on=InstanceID(str(model_name), None),
                        left_pk=pk if side == Side.left else None,
                        right_pk=pk if side == Side.right else None,
                        reason=f"""custom ordinal value `{ordinal}` appears multiple times""",
                    )
                )

            need_ordering[model_name][ordinal] = model

        for model_name, models in need_ordering.items():
            # Sort the models by key, which is a tuple of ordered custom ordinal field values,
            # specific to the model in question.
            ordered_models = dict(sorted(models.items()))
            for ordinal_value, model in ordered_models.items():
                id, found = ordinal_counters[model_name].assign(model, ordinal_value, side)
                findings.extend(found)
                model_map[model_name][id] = model

        return (model_map, ordinal_counters)

    def json_lines(obj: JSONData) -> list[str]:
        """Take a JSONData object and pretty-print it as JSON."""

        return JSON_PRETTY_PRINTER.encode(obj).splitlines()

    if comparators is None:
        comparators = get_default_comparators()

    # Because we may be scrubbing data from the objects as we compare them, we may (optionally) make
    # deep copies to start to avoid potentially mangling the input data.
    left_data = deepcopy(expect)
    right_data = deepcopy(actual)

    # Re-organize the data from both sides into maps keyed on InstanceID.
    findings = ComparatorFindings([])
    left_models, left_ordinal_counters = build_model_map(left_data, Side.left, findings)
    right_models, right_ordinal_counters = build_model_map(right_data, Side.right, findings)

    # Ensure that we have the same number of each kind of model on both sides.
    model_names = set(left_ordinal_counters.keys()).union(right_ordinal_counters.keys())
    for model_name in model_names:
        left_count = left_ordinal_counters.get(model_name, OrdinalCounter()).next_ordinal - 1
        right_count = right_ordinal_counters.get(model_name, OrdinalCounter()).next_ordinal - 1
        if left_count != right_count:
            findings.append(
                ComparatorFinding(
                    kind=ComparatorFindingKind.UnequalCounts,
                    on=InstanceID(str(model_name)),
                    reason=f"""counted {left_count} left entries and {right_count} right entries""",
                )
            )

    # If there are mismatches in the number of or ordering of models, something is seriously wrong,
    # so abort ASAP.
    if not findings.empty():
        return findings

    # As models are compared, we will add their pk mapping to separate `PrimaryKeyMaps`. Then, when
    # a foreign keyed field into the specific model is encountered, we will be able to ensure that
    # both sides reference the correct model.
    #
    # For instance, we encounter the first `sentry.User` model on both the left and right side, with
    # the left side having a `pk` of 123, and the right having `456`. This means that we want to map
    # `[sentry.User][123] = 1` on the left and `[sentry.User][456] = 1`. Later, when we encounter
    # foreign keys to a user model with `pk` 123 on the left and 456 on the right, we'll be able to
    # dereference the map to ensure that those both point to the same model on their respective
    # sides.
    left_pk_map = PrimaryKeyMap()
    right_pk_map = PrimaryKeyMap()

    # Save the pk -> ordinal mapping on both sides, so that we can decode foreign keys into this
    # model that we encounter later.
    for model_name, models in right_models.items():
        for id, right in models.items():
            assert id.ordinal is not None

            left = left_models[model_name][id]
            left_pk_map.insert(
                NormalizedModelName(id.model),
                left_models[model_name][id]["pk"],
                id.ordinal,
                ImportKind.Inserted,
            )
            right_pk_map.insert(
                NormalizedModelName(id.model), right["pk"], id.ordinal, ImportKind.Inserted
            )

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for model_name, models in right_models.items():
        for id, right in models.items():
            assert id.ordinal is not None

            # Try comparators applicable for this specific model.
            left = left_models[model_name][id]
            if id.model in comparators:
                # We take care to run ALL of the `compare()` methods on each comparator before
                # calling any `scrub()` methods. This ensures that, in cases where a single model
                # uses multiple comparators that touch the same fields, one comparator does not
                # accidentally scrub the inputs for its follower. If `compare()` functions are
                # well-behaved (that is, they don't mutate their inputs), this should be sufficient
                # to ensure that the order in which comparators are applied does not change the
                # final output.
                for cmp in comparators[id.model]:
                    ex = cmp.existence(id, left, right)
                    if ex:
                        findings.extend(ex)
                        continue

                    if isinstance(cmp, ForeignKeyComparator):
                        cmp.set_primary_key_maps(left_pk_map, right_pk_map)

                    res = cmp.compare(id, left, right)
                    if res:
                        findings.extend(res)
                for cmp in comparators[id.model]:
                    cmp.scrub(left, right)

            # Finally, perform a diff on the remaining JSON.
            diff = list(unified_diff(json_lines(left["fields"]), json_lines(right["fields"]), n=15))
            if diff:
                findings.append(
                    ComparatorFinding(
                        kind=ComparatorFindingKind.UnequalJSON,
                        on=id,
                        left_pk=left["pk"],
                        right_pk=right["pk"],
                        reason="\n    " + "\n    ".join(diff),
                    )
                )

    return findings
