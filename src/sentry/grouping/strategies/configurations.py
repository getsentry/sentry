from sentry.conf.server import FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
from sentry.grouping.strategies.base import (
    StrategyConfiguration,
    create_strategy_configuration_class,
)

# The full mapping of all known configurations.
GROUPING_CONFIG_CLASSES: dict[str, type[StrategyConfiguration]] = {}

# The implied base strategy *every* strategy inherits from if no
# base is defined.
BASE_CONFIG_CLASS = create_strategy_configuration_class(
    "BASE_CONFIG",
    # Strategy priority is enforced programaticaly via the `score` argument to the `@strategy`
    # decorator (rather than by the order they're listed here), but they are nonetheless listed here
    # from highest to lowest priority for documentation purposes. The first strategy to produce a
    # result will become the winner.
    strategies=[
        "chained-exception:v1",  # This handles single exceptions, too
        "threads:v1",
        "stacktrace:v1",
        "template:v1",
        "csp:v1",
        "hpkp:v1",
        "expect-staple:v1",
        "expect-ct:v1",
        "message:v1",
    ],
    delegates=["frame:v1", "stacktrace:v1", "single-exception:v1"],
    initial_context={
        # Perform automatic message trimming and parameter substitution in the message strategy.
        # (Should be kept on - only configurable so it can be turned off in tests.)
        "normalize_message": True,
        # Platforms for which context line should be taken into account when grouping.
        "contextline_platforms": ("javascript", "node", "python", "php", "ruby"),
    },
)


def register_grouping_config(id: str, **kwargs) -> type[StrategyConfiguration]:
    # Replace the base strategy id in kwargs with the base stategy class itself (or the default
    # base class, if no base is specified)
    base_config_id = kwargs.get("base")
    kwargs["base"] = (
        GROUPING_CONFIG_CLASSES[base_config_id] if base_config_id else BASE_CONFIG_CLASS
    )

    strategy_class = create_strategy_configuration_class(id, **kwargs)

    GROUPING_CONFIG_CLASSES[id] = strategy_class
    return strategy_class


# This is the current default config
register_grouping_config(
    id=WINTER_2023_GROUPING_CONFIG,
    # There's no `base` argument here because this config is based on `BASE_STRATEGY`. To base a
    # config on a previous config, include its `id` value as the value for `base` here.
    initial_context={
        # Shim to preserve hash values, since they're order-dependent
        "use_legacy_exception_subcomponent_order": True,
        # Preserve a long-standing bug, wherein our "non-URL frame" test actually looks for frames
        # *with* URLs
        "handle_js_single_frame_url_origin_backwards": True,
        # Don't parameterize `spawn_main(tracker_fd=12, pipe_handle=31)`-type context lines
        "prevent_python_multiprocessing_context_line_parameterization": True,
        # Ignore rather than flagging unknown fingerprint variables
        "use_legacy_unknown_variable_handling": True,
    },
    enhancements_base="all-platforms:2023-01-11",
    fingerprinting_bases=["javascript@2024-02-02"],
)

register_grouping_config(
    id=FALL_2025_GROUPING_CONFIG,
    base=WINTER_2023_GROUPING_CONFIG,
    initial_context={
        "use_legacy_exception_subcomponent_order": False,
        "handle_js_single_frame_url_origin_backwards": False,
        "prevent_python_multiprocessing_context_line_parameterization": False,
    },
    enhancements_base="all-platforms:2025-11-21",
)
