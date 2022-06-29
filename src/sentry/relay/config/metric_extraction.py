from dataclasses import dataclass
from typing import Any, List, Literal, Sequence, TypedDict, Union

from sentry.api.endpoints.project_transaction_threshold import DEFAULT_THRESHOLD
from sentry.models import (
    Project,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
    TransactionMetric,
)


class RuleConditionInner(TypedDict):
    op: Literal["eq", "gt", "gte"]
    name: str
    value: Any


# mypy does not support recursive types. type definition is a very small subset
# of the values relay actually accepts
class RuleCondition(TypedDict):
    op: Literal["and"]
    inner: Sequence[RuleConditionInner]


class MetricConditionalTaggingRule(TypedDict):
    condition: RuleCondition
    targetMetrics: Sequence[str]
    targetTag: str
    tagValue: str


_TRANSACTION_METRICS_TO_RULE_FIELD = {
    TransactionMetric.LCP.value: "event.measurements.lcp.value",
    TransactionMetric.DURATION.value: "event.duration",
}

_SATISFACTION_TARGET_METRICS = (
    "s:transactions/user@none",
    "d:transactions/duration@millisecond",
)

_SATISFACTION_TARGET_TAG = "satisfaction"

_HISTOGRAM_OUTLIERS_TARGET_METRICS = ("d:transactions/duration@millisecond",)


@dataclass
class _DefaultThreshold:
    metric: TransactionMetric
    threshold: int


_DEFAULT_THRESHOLD = _DefaultThreshold(
    metric=TransactionMetric[DEFAULT_THRESHOLD["metric"].upper()].value,
    threshold=int(DEFAULT_THRESHOLD["threshold"]),
)


def get_metric_conditional_tagging_rules(
    project: Project,
) -> Sequence[MetricConditionalTaggingRule]:
    rules: List[MetricConditionalTaggingRule] = []

    # transaction-specific overrides must precede the project-wide threshold in the list of rules.
    for threshold in project.projecttransactionthresholdoverride_set.all().order_by("transaction"):
        rules.extend(
            _threshold_to_rules(
                threshold,
                [{"op": "eq", "name": "event.transaction", "value": threshold.transaction}],
            )
        )

    # Rules are processed top-down. The following is a fallback for when
    # there's no transaction-name-specific rule:

    try:
        threshold = ProjectTransactionThreshold.objects.get(project=project)
        rules.extend(_threshold_to_rules(threshold, []))
    except ProjectTransactionThreshold.DoesNotExist:
        rules.extend(_threshold_to_rules(_DEFAULT_THRESHOLD, []))

    rules.extend(_produce_histogram_outliers())

    return rules


def _threshold_to_rules(
    threshold: Union[
        ProjectTransactionThreshold, ProjectTransactionThresholdOverride, _DefaultThreshold
    ],
    extra_conditions: Sequence[RuleConditionInner],
) -> Sequence[MetricConditionalTaggingRule]:
    frustrated: MetricConditionalTaggingRule = {
        "condition": {
            "op": "and",
            "inner": [
                {
                    "op": "gt",
                    "name": _TRANSACTION_METRICS_TO_RULE_FIELD[threshold.metric],
                    # The frustration threshold is always four times the threshold
                    # (see https://docs.sentry.io/product/performance/metrics/#apdex)
                    "value": threshold.threshold * 4,
                },
                *extra_conditions,
            ],
        },
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "frustrated",
    }
    tolerated: MetricConditionalTaggingRule = {
        "condition": {
            "op": "and",
            "inner": [
                {
                    "op": "gt",
                    "name": _TRANSACTION_METRICS_TO_RULE_FIELD[threshold.metric],
                    "value": threshold.threshold,
                },
                *extra_conditions,
            ],
        },
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "tolerated",
    }
    satisfied: MetricConditionalTaggingRule = {
        "condition": {"op": "and", "inner": list(extra_conditions)},
        "targetMetrics": _SATISFACTION_TARGET_METRICS,
        "targetTag": _SATISFACTION_TARGET_TAG,
        "tagValue": "satisfied",
    }

    # Order is important here, as rules for a particular tag name are processed
    # top-down, and rules are skipped if the tag has already been defined by a
    # previous rule.
    #
    # if duration > 4000 {
    #     frustrated
    # } else if duration > 1000 {
    #     tolerated
    # } else {
    #     satisfied
    # }
    return [frustrated, tolerated, satisfied]


def _produce_histogram_outliers() -> Sequence[MetricConditionalTaggingRule]:
    # SELECT
    #     platform,
    #     transaction_op AS op,
    #     uniqCombined64(project_id) AS c,
    #     quantiles(0.25, 0.75)(duration)
    # FROM transactions_dist
    # WHERE timestamp > subtractHours(now(), 48)
    # GROUP BY
    #     platform,
    #     op
    # ORDER BY c DESC
    # LIMIT 50
    query_results = [
        ("javascript", "pageload", (1282.75, 3783.25)),
        ("javascript", "navigation", (333, 1033)),
        ("python", "http.server", (3, 97)),
        ("node", "http.server", (1, 84)),
        ("php", "http.server", (34, 223)),
        ("ruby", "rails.request", (3, 61)),
        ("python", "celery.task", (25, 442)),
        ("javascript", "ui.load", (1476.75, 431482.25)),
        ("cocoa", "ui.load", (129, 623)),
        ("node", "awslambda.handler", (32, 466.25)),
        ("csharp", "http.server", (0, 46)),
        ("python", "serverless.function", (17, 251.25)),
        ("java", "http.server", (2, 32)),
        ("java", "ui.load", (37, 266.25)),
        ("ruby", "active_job", (15, 366)),
        ("ruby", "sidekiq", (15, 300)),
        ("javascript", "default", (9, 850.25)),
        ("python", "asgi.server", (49, 327)),
        ("other", "navigation", (999, 3002)),
        ("php", "console.command", (60, 1033.75)),
        ("node", "default", (10, 480)),
        ("node", "transaction", (1, 45)),
        ("python", "rq.task", (627.75, 3113)),
        ("go", "http.server", (0, 133)),
        ("other", "pageload", (3000, 3000)),
        ("ruby", "rails.action_cable", (0, 4)),
        ("ruby", "rack.request", (2, 40)),
        ("node", "gql", (19, 203)),
        ("other", "http.server", (4, 23)),
        ("node", "test", (2, 262)),
        ("python", "default", (27, 1106.25)),
        ("node", "gcp.function.http", (3, 1594.5)),
        ("php", "sentry.test", (0, 257.5)),
        ("python", "websocket.server", (1, 2)),
        ("java", "navigation", (230, 1623.25)),
        ("ruby", "delayed_job", (9, 902.75)),
        ("python", "task", (10, 1071.25)),
        ("php", "queue.process", (51, 452)),
        ("python", "query", (24, 273)),
        ("python", "mutation", (25, 105)),
        ("node", "request", (10, 59)),
        ("java", "task", (0, 647)),
        ("other", "task", (49, 412)),
        ("node", "gcp.function.event", (243, 2393)),
        ("php", "default", (18, 121)),
        ("php", "queue.job", (35, 287)),
        ("php", "http.request", (26, 282)),
        ("go", "grpc.server", (1, 13)),
        ("node", "execute", (42, 222)),
        ("node", "functions.https.onCall", (10, 233)),
    ]

    rules: List[MetricConditionalTaggingRule] = []
    for platform, op, (p25, p75) in query_results:
        rules.append(
            {
                "condition": {
                    "op": "and",
                    "inner": [
                        {"op": "eq", "name": "event.contexts.trace.op", "value": op},
                        {"op": "eq", "name": "event.platform", "value": platform},
                        # This is in line with https://github.com/getsentry/sentry/blob/63308b3f2256fe2f24da43a951154d0ef2218d19/src/sentry/snuba/discover.py#L1728-L1729=
                        # See also https://en.wikipedia.org/wiki/Outlier#Tukey's_fences
                        {"op": "gte", "name": "event.duration", "value": p25 + 3 * abs(p75 - p25)},
                    ],
                },
                "targetMetrics": _HISTOGRAM_OUTLIERS_TARGET_METRICS,
                "targetTag": "histogram_outlier",
                "tagValue": "outlier",
            }
        )

    rules.append(
        {
            "condition": {
                "op": "and",
                "inner": [
                    {"op": "gte", "name": "event.duration", "value": 0},
                ],
            },
            "targetMetrics": _HISTOGRAM_OUTLIERS_TARGET_METRICS,
            "targetTag": "histogram_outlier",
            "tagValue": "inlier",
        }
    )

    rules.append(
        {
            "condition": {"op": "and", "inner": []},
            "targetMetrics": _HISTOGRAM_OUTLIERS_TARGET_METRICS,
            "targetTag": "histogram_outlier",
            "tagValue": "outlier",
        }
    )

    return rules
