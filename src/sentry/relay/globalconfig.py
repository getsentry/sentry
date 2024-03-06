from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

import sentry.options
from sentry.relay.config.measurements import MeasurementsConfig, get_measurements_config
from sentry.utils import metrics

# List of options to include in the global config.
RELAY_OPTIONS: list[str] = [
    "profiling.profile_metrics.unsampled_profiles.platforms",
    "profiling.profile_metrics.unsampled_profiles.sample_rate",
    "profiling.profile_metrics.unsampled_profiles.enabled",
    "relay.span-usage-metric",
    "relay.cardinality-limiter.mode",
    "relay.cardinality-limiter.error-sample-rate",
    "relay.metric-bucket-encodings",
]


class GenericFilter(TypedDict):
    id: str
    isEnabled: bool
    condition: Mapping[str, str] | None
    """A rule condition in the DSL compatible with Relay.

    See https://github.com/getsentry/relay/blob/d4b8402e6853eb62b2402f8f8c8482adae518474/relay-protocol/src/condition.rs#L341.
    """


class GenericFiltersConfig(TypedDict):
    version: int
    filters: Sequence[GenericFilter]


class GlobalConfig(TypedDict, total=False):
    measurements: MeasurementsConfig
    filters: GenericFiltersConfig | None
    options: dict[str, Any]


def get_global_generic_filters() -> GenericFiltersConfig:
    return {
        "version": 1,
        "filters": [],
    }


@metrics.wraps("relay.globalconfig.get")
def get_global_config():
    """Return the global configuration for Relay."""

    global_config: GlobalConfig = {
        "measurements": get_measurements_config(),
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
