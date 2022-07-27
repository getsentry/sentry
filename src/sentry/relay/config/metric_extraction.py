import csv
from dataclasses import dataclass
from typing import Any, List, Literal, Sequence, Tuple, TypedDict, Union

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
    "d:transactions/measurements.lcp@millisecond",
)

_SATISFACTION_TARGET_TAG = "satisfaction"

_HISTOGRAM_OUTLIERS_TARGET_METRICS = {
    "duration": "d:transactions/duration@millisecond",
    "lcp": "d:transactions/measurements.lcp@millisecond",
    "fcp": "d:transactions/measurements.fcp@millisecond",
}


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

    rules.extend(_HISTOGRAM_OUTLIER_RULES)

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


# Generated from a one-off query:
#
# SELECT
#     platform,
#     transaction_op AS op,
#     uniqCombined64(project_id) AS c,
#     quantiles(0.25, 0.75)(duration) as duration,
#     quantiles(0.25, 0.75)(measurements.value[indexOf(measurements.key, 'lcp')]) as lcp,
#     quantiles(0.25, 0.75)(measurements.value[indexOf(measurements.key, 'fcp')]) as fcp
# FROM transactions_dist
# WHERE timestamp > subtractHours(now(), 48)
# GROUP BY
#     platform,
#     op
# ORDER BY c DESC
# LIMIT 50
# FORMAT CSVWithNames
_HISTOGRAM_OUTLIERS_QUERY_RESULTS = """
"javascript","pageload",35018,"[1440,4137.25]","[0,0]","[0,1321.250081062317]"
"javascript","navigation",28523,"[405,1036]","[0,0]","[0,0]"
"python","http.server",12234,"[3,111]","[0,0]","[0,0]"
"node","http.server",8774,"[2,91]","[0,0]","[0,0]"
"php","http.server",7260,"[33,212]","[0,0]","[0,0]"
"python","celery.task",2947,"[19,304]","[0,0]","[0,0]"
"ruby","rails.request",2923,"[7,105]","[0,0]","[0,0]"
"javascript","ui.load",2714,"[1708,4302296.25]","[0,0]","[0,0]"
"cocoa","ui.load",1539,"[94,625]","[0,0]","[0,0]"
"node","awslambda.handler",1503,"[15,300]","[0,0]","[0,0]"
"csharp","http.server",1188,"[0,59]","[0,0]","[0,0]"
"java","http.server",1052,"[3,68.25]","[0,0]","[0,0]"
"python","serverless.function",1038,"[21,384]","[0,0]","[0,0]"
"java","ui.load",993,"[70,580]","[0,0]","[0,0]"
"ruby","active_job",688,"[13,217]","[0,0]","[0,0]"
"ruby","sidekiq",626,"[12,210]","[0,0]","[0,0]"
"javascript","default",532,"[182.75,1074.5]","[0,0]","[0,0]"
"python","asgi.server",370,"[152,840.25]","[0,0]","[0,0]"
"other","navigation",362,"[1001,3002]","[0,0]","[0,0]"
"php","console.command",237,"[48,1577]","[0,0]","[0,0]"
"node","default",215,"[42,302]","[0,0]","[0,0]"
"node","transaction",211,"[1,50]","[0,0]","[0,0]"
"go","http.server",192,"[0,41]","[0,0]","[0,0]"
"ruby","rails.action_cable",186,"[0,6]","[0,0]","[0,0]"
"python","rq.task",172,"[99,654]","[0,0]","[0,0]"
"other","pageload",156,"[3000,3000]","[4589.822045672948,4589.822045672948]","[3384.3555060724457,3384.3555060724457]"
"node","gql",123,"[14,220]","[0,0]","[0,0]"
"ruby","rack.request",121,"[2,76]","[0,0]","[0,0]"
"node","test",107,"[14.75,1997]","[0,0]","[0,0]"
"node","gcp.function.http",103,"[5,426.25]","[0,0]","[0,0]"
"python","default",91,"[4,462.25]","[0,0]","[0,0]"
"php","queue.process",88,"[20,319]","[0,0]","[0,0]"
"python","task",86,"[3,299]","[0,0]","[0,0]"
"other","http.server",81,"[4,20]","[0,0]","[0,0]"
"python","websocket.server",74,"[1,124]","[0,0]","[0,0]"
"php","sentry.test",66,"[0,175.5]","[0,0]","[0,0]"
"ruby","delayed_job",63,"[6,54]","[0,0]","[0,0]"
"node","request",60,"[4,239]","[0,0]","[0,0]"
"python","query",57,"[40,286]","[0,0]","[0,0]"
"java","navigation",50,"[107,2035]","[0,0]","[0,0]"
"python","mutation",49,"[8,60]","[0,0]","[0,0]"
"java","task",49,"[150,727]","[0,0]","[0,0]"
"other","task",42,"[137,804]","[0,0]","[0,0]"
"php","http.request",38,"[44,328]","[0,0]","[0,0]"
"node","execute",38,"[23,215]","[0,0]","[0,0]"
"node","gcp.function.event",37,"[0,394]","[0,0]","[0,0]"
"cocoa","ui.action",32,"[716,2668.25]","[0,0]","[0,0]"
"php","default",31,"[14,74]","[0,0]","[0,0]"
"cocoa","ui.action.click",29,"[541.75,2988]","[0,0]","[0,0]"
"node","functions.https.onCall",28,"[12,309]","[0,0]","[0,0]"
"""


def _parse_percentiles(value: str) -> Tuple[float, float]:
    p25, p75 = map(float, value.strip("[]").split(","))
    return p25, p75


def _produce_histogram_outliers(query_csv: str) -> Sequence[MetricConditionalTaggingRule]:
    rules: List[MetricConditionalTaggingRule] = []
    for platform, op, _, duration, lcp, fcp in csv.reader(query_csv.strip().splitlines()):
        duration_p25, duration_p75 = _parse_percentiles(duration)
        lcp_p25, lcp_p75 = _parse_percentiles(lcp)
        fcp_p25, fcp_p75 = _parse_percentiles(fcp)

        for metric, p25, p75 in (
            ("duration", duration_p25, duration_p75),
            ("lcp", lcp_p25, lcp_p75),
            ("fcp", fcp_p25, fcp_p75),
        ):
            if p25 == p75 == 0:
                # default values from clickhouse if no data is present
                continue

            rules.append(
                {
                    "condition": {
                        "op": "and",
                        "inner": [
                            {"op": "eq", "name": "event.contexts.trace.op", "value": op},
                            {"op": "eq", "name": "event.platform", "value": platform},
                            # This is in line with https://github.com/getsentry/sentry/blob/63308b3f2256fe2f24da43a951154d0ef2218d19/src/sentry/snuba/discover.py#L1728-L1729=
                            # See also https://en.wikipedia.org/wiki/Outlier#Tukey's_fences
                            {
                                "op": "gte",
                                "name": "event.duration",
                                "value": p75 + 3 * abs(p75 - p25),
                            },
                        ],
                    },
                    "targetMetrics": [_HISTOGRAM_OUTLIERS_TARGET_METRICS[metric]],
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
            "targetMetrics": list(_HISTOGRAM_OUTLIERS_TARGET_METRICS.values()),
            "targetTag": "histogram_outlier",
            "tagValue": "inlier",
        }
    )

    rules.append(
        {
            "condition": {"op": "and", "inner": []},
            "targetMetrics": list(_HISTOGRAM_OUTLIERS_TARGET_METRICS.values()),
            "targetTag": "histogram_outlier",
            "tagValue": "outlier",
        }
    )

    return rules


_HISTOGRAM_OUTLIER_RULES = _produce_histogram_outliers(_HISTOGRAM_OUTLIERS_QUERY_RESULTS)
