from typing import Any, Optional

from sentry.spans.grouping.strategy.config import (
    CONFIGURATIONS,
    DEFAULT_CONFIG_ID,
    SpanGroupingConfig,
)


class SpanGroupingConfigNotFound(LookupError):
    pass


def load_span_grouping_config(config: Optional[Any] = None) -> SpanGroupingConfig:
    if config is None:
        config_id = DEFAULT_CONFIG_ID

    else:
        if "id" not in config:
            raise ValueError("Malformed configuration: missing 'id'")
        config_id = config["id"]

    if config_id not in CONFIGURATIONS:
        raise SpanGroupingConfigNotFound(config_id)

    return CONFIGURATIONS[config_id]
