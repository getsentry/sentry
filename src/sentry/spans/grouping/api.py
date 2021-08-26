from typing import Any, Optional

from sentry.spans.grouping.strategy.config import (
    CONFIGURATIONS,
    DEFAULT_CONFIG_ID,
    SpanGroupingConfig,
)


class SpanGroupingConfigNotFound(LookupError):
    pass


def get_span_grouping_config(config_id: str) -> SpanGroupingConfig:
    if config_id not in CONFIGURATIONS:
        raise SpanGroupingConfigNotFound(config_id)
    return CONFIGURATIONS[config_id]


def get_default_span_grouping_config() -> SpanGroupingConfig:
    return get_span_grouping_config(DEFAULT_CONFIG_ID)


def load_span_grouping_config(config: Optional[Any] = None) -> SpanGroupingConfig:
    if config is None:
        strategy = get_default_span_grouping_config()
    else:
        if "id" not in config:
            raise ValueError("Malformed configuration: missing 'id'")
        strategy = get_span_grouping_config(config["id"])
    return strategy
