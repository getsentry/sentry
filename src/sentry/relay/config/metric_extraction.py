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
    op: Literal["eq", "gt"]
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
    TransactionMetric.LCP.value: "transaction.measurements.lcp",
    TransactionMetric.DURATION.value: "transaction.duration",
}

_SATISFACTION_TARGET_METRICS = (
    "s:transactions/user@none",
    "d:transactions/duration@millisecond",
)

_SATISFACTION_TARGET_TAG = "satisfaction"


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
    for threshold in project.projecttransactionthresholdoverride_set.all():
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
        pass

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
