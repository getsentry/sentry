from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from difflib import unified_diff
from typing import Dict, Tuple

from sentry.backup.comparators import DEFAULT_COMPARATORS, ComparatorMap
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
    comparators: ComparatorMap = DEFAULT_COMPARATORS,
) -> ComparatorFindings:
    """Ensures that originally imported data correctly matches actual outputted data, and produces a
    list of reasons why not when it doesn't.
    """

    class OrdinalCounter:
        """Keeps track of the next ordinal to be assigned for a given model kind."""

        max_seen_pk: int
        next_ordinal: int

        def __init__(self):
            self.max_seen_pk = -1
            self.next_ordinal = 1

        def assign(self, obj: JSONData, side: Side) -> Tuple[int, list[ComparatorFinding]]:
            """Assigns the next available ordinal to the supplied `obj` model."""

            pk = obj["pk"]
            model = obj["model"]
            findings = []
            if pk > self.max_seen_pk:
                self.max_seen_pk = pk
            else:
                findings.append(
                    ComparatorFinding(
                        kind=ComparatorFindingKind.UnorderedInput,
                        on=InstanceID(model, self.next_ordinal),
                        left_pk=pk if side == Side.left else None,
                        right_pk=pk if side == Side.right else None,
                        reason=f"""instances not listed in ascending `pk` order; `pk` {pk} is less than or equal to {self.max_seen_pk} which precedes it""",
                    )
                )

            obj["ordinal"] = self.next_ordinal
            self.next_ordinal += 1
            return (obj["ordinal"], findings if findings else [])

    OrdinalCounters = Dict[str, OrdinalCounter]
    ModelMap = Dict[InstanceID, JSONData]

    def build_model_map(
        models: JSONData, side: Side, findings: ComparatorFindings
    ) -> Tuple[ModelMap, OrdinalCounters]:
        """Does two things in tandem: builds a map of InstanceID -> JSON model, and simultaneously builds a map of model name -> number of ordinals assigned."""

        model_map: ModelMap = {}
        ordinal_counters: OrdinalCounters = defaultdict(OrdinalCounter)
        for model in models:
            model_name = model["model"]
            counter = ordinal_counters[model_name]
            ordinal, found = counter.assign(model, side)
            findings.extend(found)
            id = InstanceID(model_name, ordinal)
            model_map[id] = model
        return (model_map, ordinal_counters)

    def json_lines(obj: JSONData) -> list[str]:
        """Take a JSONData object and pretty-print it as JSON."""

        return JSON_PRETTY_PRINTER.encode(obj).splitlines()

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
                    on=InstanceID(model_name),
                    reason=f"""counted {left_count} left entries and {right_count} right entries""",
                )
            )

    # If there are mismatches in the number of or ordering of models, something is seriously wrong,
    # so abort ASAP.
    if not findings.empty():
        return findings

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, right in right_models.items():
        left = left_models[id]

        # Try comparators applicable for this specific model.
        if id.model in comparators:
            # We take care to run ALL of the `compare()` methods on each comparator before calling
            # any `scrub()` methods. This ensures that, in cases where a single model uses multiple
            # comparators that touch the same fields, one comparator does not accidentally scrub the
            # inputs for its follower. If `compare()` functions are well-behaved (that is, they
            # don't mutate their inputs), this should be sufficient to ensure that the order in
            # which comparators are applied does not change the final output.
            for cmp in comparators[id.model]:
                ex = cmp.existence(id, left, right)
                if ex:
                    findings.extend(ex)
                    continue

                res = cmp.compare(id, left, right)
                if res:
                    findings.extend(res)
            for cmp in comparators[id.model]:
                cmp.scrub(left, right)

        # Finally, perform a diff on the remaining JSON.
        diff = list(unified_diff(json_lines(left["fields"]), json_lines(right["fields"]), n=3))
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
