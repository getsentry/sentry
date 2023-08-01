from __future__ import annotations

from copy import deepcopy
from difflib import unified_diff

from sentry.backup.comparators import DEFAULT_COMPARATORS, ComparatorMap
from sentry.backup.findings import ComparatorFinding, ComparatorFindings, InstanceID
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

    def json_lines(obj: JSONData) -> list[str]:
        """Take a JSONData object and pretty-print it as JSON."""

        return JSON_PRETTY_PRINTER.encode(obj).splitlines()

    findings = ComparatorFindings([])
    exp_models = {}
    act_models = {}
    for model in expect:
        id = InstanceID(model["model"], model["pk"])
        exp_models[id] = model

    # Because we may be scrubbing data from the objects as we compare them, we may (optionally) make
    # deep copies to start to avoid potentially mangling the input data.
    expect = deepcopy(expect)
    actual = deepcopy(actual)

    # Ensure that the actual JSON contains no duplicates - we assume that the expected JSON did not.
    for model in actual:
        id = InstanceID(model["model"], model["pk"])
        if id in act_models:
            findings.append(ComparatorFinding("DuplicateEntry", id))
        else:
            act_models[id] = model

    # Report unexpected and missing entries in the actual JSON.
    extra = sorted(act_models.keys() - exp_models.keys())
    missing = sorted(exp_models.keys() - act_models.keys())
    for id in extra:
        del act_models[id]
        findings.append(ComparatorFinding("UnexpectedEntry", id))
    for id in missing:
        del exp_models[id]
        findings.append(ComparatorFinding("MissingEntry", id))

    # We only perform custom comparisons and JSON diffs on non-duplicate entries that exist in both
    # outputs.
    for id, act in act_models.items():
        exp = exp_models[id]

        # Try comparators applicable for this specific model.
        if id.model in comparators:
            # We take care to run ALL of the `compare()` methods on each comparator before calling
            # any `scrub()` methods. This ensures that, in cases where a single model uses multiple
            # comparators that touch the same fields, one comparator does not accidentally scrub the
            # inputs for its follower. If `compare()` functions are well-behaved (that is, they
            # don't mutate their inputs), this should be sufficient to ensure that the order in
            # which comparators are applied does not change the final output.
            for cmp in comparators[id.model]:
                ex = cmp.existence(id, exp, act)
                if ex:
                    findings.extend(ex)
                    continue

                res = cmp.compare(id, exp, act)
                if res:
                    findings.extend(res)
            for cmp in comparators[id.model]:
                cmp.scrub(exp, act)

        # Finally, perform a diff on the remaining JSON.
        diff = list(unified_diff(json_lines(exp["fields"]), json_lines(act["fields"]), n=3))
        if diff:
            findings.append(ComparatorFinding("UnequalJSON", id, "\n    " + "\n    ".join(diff)))

    return findings
