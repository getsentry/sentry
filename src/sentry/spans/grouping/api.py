from typing import Any, Optional

from sentry.spans.grouping.strategy.config import CONFIGURATIONS, SpanGroupingConfig


def get_span_grouping_config(id: str) -> SpanGroupingConfig:
    # TODO: needs some error handling here
    return CONFIGURATIONS[id]


def get_default_span_grouping_config() -> SpanGroupingConfig:
    return get_span_grouping_config("builtin:2021-08-25")


def load_span_grouping_config(config: Optional[Any] = None) -> SpanGroupingConfig:
    if config is None:
        strategy = get_default_span_grouping_config()
    else:
        assert "id" in config  # TODO: better error handling
        strategy = get_span_grouping_config(config["id"])
    return strategy
