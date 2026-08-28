"""Guards which pr_metrics counters are emitted at the ambient sample rate.

Most of the module's counters fire a handful of times a day. Sampled, such a
counter resolves to about one surviving packet per reporting bucket, so its chart
quantizes and "never fired" is indistinguishable from "fired a few times". Those
call sites pass ``sample_rate=1.0``.

A few carry enough volume that sampling already resolves their rate. They are
listed below so that staying ambient is a decision rather than an oversight — a
new counter is unsampled unless deliberately added here.

``sample_rate`` is per packet, so one metric name can carry both rates and still
total correctly. What must not drift is a single *tag value* split across rates:
still correct in aggregate, but no longer exact. Hence both ``untracked`` entries.
"""

import ast
import pathlib

PR_METRICS = pathlib.Path(__file__).parents[3] / "src" / "sentry" / "pr_metrics"

# (module, metric name, `reason` tag if the call hardcodes one)
DELIBERATELY_SAMPLED = {
    ("activity_doc.py", "pr_metrics.activity_doc.check_head_groups_capped", None),
    ("activity_doc.py", "pr_metrics.activity_doc.check_groups_capped", None),
    ("emit.py", "pr_metrics.emit.skipped", "untracked"),
    ("webhooks.py", "pr_metrics.emit.skipped", "untracked"),
    ("webhooks.py", "pr_metrics.check.activity_recorded", None),
}

_EMITTERS = ("incr", "gauge", "timing", "distribution", "set")


def _reason_tag(call: ast.Call) -> str | None:
    for keyword in call.keywords:
        if keyword.arg != "tags" or not isinstance(keyword.value, ast.Dict):
            continue
        for key, value in zip(keyword.value.keys, keyword.value.values):
            if (
                isinstance(key, ast.Constant)
                and key.value == "reason"
                and isinstance(value, ast.Constant)
                and isinstance(value.value, str)
            ):
                return value.value
    return None


def _metric_calls() -> list[tuple[str, ast.Call]]:
    calls = []
    for path in sorted(PR_METRICS.glob("*.py")):
        for node in ast.walk(ast.parse(path.read_text())):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            if not isinstance(node.func.value, ast.Name) or node.func.value.id != "metrics":
                continue
            if node.func.attr in _EMITTERS:
                calls.append((path.name, node))
    return calls


def _sample_rate(call: ast.Call) -> str | None:
    return next(
        (ast.unparse(kw.value) for kw in call.keywords if kw.arg == "sample_rate"),
        None,
    )


def test_only_listed_call_sites_are_sampled() -> None:
    sampled = set()
    for module, call in _metric_calls():
        if _sample_rate(call) is not None:
            continue
        name = call.args[0].value if isinstance(call.args[0], ast.Constant) else None
        sampled.add((module, name, _reason_tag(call)))

    assert sampled == DELIBERATELY_SAMPLED


def test_no_partial_sample_rates() -> None:
    # A rate between the ambient one and 1.0 buys neither an exact count nor a
    # cheaper packet stream, and makes two counters on one path incomparable.
    rates = {
        (module, ast.unparse(call.args[0]), rate)
        for module, call in _metric_calls()
        if (rate := _sample_rate(call)) is not None
    }
    assert {rate for _, _, rate in rates} == {"1.0"}
