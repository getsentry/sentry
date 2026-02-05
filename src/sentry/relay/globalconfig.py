from typing import Any, TypedDict

import sentry.options
from sentry.relay.config.ai_model_costs import AIModelCosts, ai_model_costs_config
from sentry.relay.config.ai_operation_type_map import (
    AIOperationTypeMap,
    ai_operation_type_map_config,
)
from sentry.relay.config.measurements import MeasurementsConfig, get_measurements_config
from sentry.relay.config.metric_extraction import (
    MetricExtractionGroups,
    global_metric_extraction_groups,
)
from sentry.relay.types import GenericFiltersConfig, RuleCondition
from sentry.utils import metrics

# List of options to include in the global config.
RELAY_OPTIONS: list[str] = [
    "profiling.profile_metrics.unsampled_profiles.platforms",
    "profiling.profile_metrics.unsampled_profiles.sample_rate",
    "profiling.profile_metrics.unsampled_profiles.enabled",
    "relay.span-usage-metric",
    "relay.cardinality-limiter.mode",
    "relay.cardinality-limiter.error-sample-rate",
    "relay.metric-bucket-set-encodings",
    "relay.metric-bucket-distribution-encodings",
    "relay.span-normalization.allowed_hosts",
    "relay.drop-transaction-attachments",
    "replay.relay-snuba-publishing-disabled.sample-rate",
]


class SpanOpDefaultRule(TypedDict):
    condition: RuleCondition
    value: str


class SpanOpDefaults(TypedDict):
    rules: list[SpanOpDefaultRule]


class GlobalConfig(TypedDict, total=False):
    measurements: MeasurementsConfig
    aiModelCosts: AIModelCosts | None
    aiOperationTypeMap: AIOperationTypeMap
    metricExtraction: MetricExtractionGroups
    filters: GenericFiltersConfig | None
    spanOpDefaults: SpanOpDefaults
    options: dict[str, Any]


def get_global_generic_filters() -> GenericFiltersConfig:
    return {
        "version": 1,
        "filters": [],
    }


def span_op_defaults() -> SpanOpDefaults:
    return {
        "rules": [
            {
                # If span.data[messaging.system] is set, use span.op "message":
                "condition": {
                    "op": "not",
                    "inner": {
                        "op": "eq",
                        "name": "span.data.messaging\\.system",
                        "value": None,
                    },
                },
                "value": "message",
            }
        ]
    }


@metrics.wraps("relay.globalconfig.get")
def get_global_config() -> GlobalConfig:
    """Return the global configuration for Relay."""

    global_config: GlobalConfig = {
        "measurements": get_measurements_config(),
        "aiModelCosts": ai_model_costs_config(),
        "aiOperationTypeMap": ai_operation_type_map_config(),
        "metricExtraction": global_metric_extraction_groups(),
        "spanOpDefaults": span_op_defaults(),
    }

    filters = get_global_generic_filters()
    if filters and len(filters["filters"]) > 0:
        global_config["filters"] = filters

    options = dict()
    for option in RELAY_OPTIONS:
        if (value := sentry.options.get(option)) is not None:
            options[option] = value

    if options:
        global_config["options"] = options

    return global_config
