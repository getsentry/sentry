from sentry.grouping.strategies.base import (
    RISK_LEVEL_HIGH,
    StrategyConfiguration,
    create_strategy_configuration_class,
)

# The full mapping of all known configurations.
CONFIGURATIONS: dict[str, type[StrategyConfiguration]] = {}

# The implied base strategy *every* strategy inherits from if no
# base is defined.
BASE_STRATEGY = create_strategy_configuration_class(
    None,
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
        # This key in the context tells the system which variant should
        # be produced.  TODO: phase this out.
        "variant": None,
        # This is a flag that can be used by any delegate to respond to
        # a detected recursion.  This is currently used by the frame
        # strategy to disable itself.  Recursion is detected by the outer
        # strategy.
        "is_recursion": False,
        # This turns on the automatic message trimming and parameter substitution
        # by the message strategy. (Only still configurable so it can be turned off in tests.)
        "normalize_message": True,
        # Platforms for which context line should be taken into
        # account when grouping.
        "contextline_platforms": ("javascript", "node", "python", "php", "ruby"),
        # Turns on falling back to exception values when there
        # is no stacktrace.
        "with_exception_value_fallback": True,
        # Stacktrace is produced in the context of this exception
        "exception_data": None,
    },
)


def register_strategy_config(id: str, **kwargs) -> type[StrategyConfiguration]:
    if kwargs.get("base") is not None:
        kwargs["base"] = CONFIGURATIONS[kwargs["base"]]
    else:
        kwargs["base"] = BASE_STRATEGY
    strategy_class = create_strategy_configuration_class(id, **kwargs)
    CONFIGURATIONS[id] = strategy_class
    return strategy_class


register_strategy_config(
    id="newstyle:2023-01-11",
    # There's no `base` argument here because this config is based on `BASE_STRATEGY`. To base a
    # config on a previous config, include its `id` value as the value for `base` here.
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Better rules for when to take context lines into account for
          JavaScript platforms for grouping purposes.
        * Better support for PHP7 anonymous classes.
        * Added new language/platform specific stack trace grouping enhancements rules
          that should make the default grouping experience better.
          This includes JavaScript, Python, PHP, Go, Java and Kotlin.
        * Added ChukloadErrors via new built-in fingerprinting support.
    """,
    # There's nothing in the initial context because this config uses all the default values. If we
    # change grouping behavior in a future config, it should be gated by a config feature, that
    # feature should be defaulted to False in the base config, and then the `initial_context` in the
    # new config is where we'd flip it to True.
    initial_context={},
    enhancements_base="newstyle:2023-01-11",
    fingerprinting_bases=["javascript@2024-02-02"],
)
