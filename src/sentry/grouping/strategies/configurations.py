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


register_grouping_config(
    id="newstyle:2023-01-11",
    # There's no `base` argument here because this config is based on `BASE_STRATEGY`. To base a
    # config on a previous config, include its `id` value as the value for `base` here.
    #
    # There's nothing in the initial context because this config uses all the default values. If we
    # change grouping behavior in a future config, it should be gated by a config feature, that
    # feature should be defaulted to False in the base config, and then the `initial_context` in the
    # new config is where we'd flip it to True.
    initial_context={},
    enhancements_base="all-platforms:2023-01-11",
    fingerprinting_bases=["javascript@2024-02-02"],
)
