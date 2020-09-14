from __future__ import absolute_import

from sentry.grouping.strategies.base import (
    create_strategy_configuration,
    RISK_LEVEL_MEDIUM,
    RISK_LEVEL_HIGH,
)


# The classes of grouping algorithms
CLASSES = []

# The full mapping of all known configurations.
CONFIGURATIONS = {}


def register_strategy_config(id, **kwargs):
    if kwargs.get("base") is not None:
        kwargs["base"] = CONFIGURATIONS[kwargs["base"]]
    rv = create_strategy_configuration(id, **kwargs)
    if rv.config_class not in CLASSES:
        CLASSES.append(rv.config_class)
    CONFIGURATIONS[rv.id] = rv
    return rv


# Legacy groupings
#
# These we do not plan on changing much, but bugfixes here might still go
# into new grouping versions.

register_strategy_config(
    id="legacy:2019-03-12",
    strategies=[
        "expect-ct:v1",
        "expect-staple:v1",
        "hpkp:v1",
        "csp:v1",
        "threads:legacy",
        "stacktrace:legacy",
        "chained-exception:legacy",
        "template:v1",
        "message:v1",
    ],
    delegates=["frame:legacy", "stacktrace:legacy", "single-exception:legacy"],
    changelog="""
        * Traditional grouping algorithm
        * Some known weaknesses with regards to grouping of native frames
    """,
)

# Simple newstyle grouping
#
# This is a grouping strategy that applies very simple rules and will
# become the new default at one point.  Optimized for native and
# javascript but works for all platforms.

register_strategy_config(
    id="newstyle:2019-05-08",
    strategies=[
        "expect-ct:v1",
        "expect-staple:v1",
        "hpkp:v1",
        "csp:v1",
        "threads:v1",
        "stacktrace:v1",
        "chained-exception:v1",
        "template:v1",
        "message:v2",
    ],
    risk=RISK_LEVEL_HIGH,
    delegates=["frame:v3", "stacktrace:v1", "single-exception:v2"],
    changelog="""
        * Uses source code information all platforms with reliable sources
          for grouping (JavaScript, Python, PHP and Ruby) and function
          names and filenames otherwise.
        * Fallback grouping applies clean-up logic on exception messages
          (numbers, uuids, email addresses and others are removed)
        * JavaScript stacktraces are better deduplicated across browser
          versions yielding a higher chance of these grouping together.
        * JavaScript stacktraces involving source maps are likely to group
          better.
        * C/C++ and other native stacktraces are more reliably grouped.
    """,
)

register_strategy_config(
    id="newstyle:2019-10-29",
    base="newstyle:2019-05-08",
    delegates=["frame:v4"],
    risk=RISK_LEVEL_MEDIUM,
    changelog="""
        * Better rules for when to take context lines into account for
          JavaScript platforms for grouping purposes.
        * Better support for PHP7 anonymous classes.
    """,
)


# Deprecated strategies
#
# These should not be used.  They are experiments which should be phased out
# once there are no projects on them.

register_strategy_config(
    id="newstyle:2019-04-05",
    strategies=[
        "expect-ct:v1",
        "expect-staple:v1",
        "hpkp:v1",
        "csp:v1",
        "threads:v1",
        "stacktrace:v1",
        "chained-exception:v1",
        "template:v1",
        "message:v1",
    ],
    delegates=["frame:v1", "stacktrace:v1", "single-exception:v1"],
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Experimental grouping algorithm (should not be used)
    """,
    hidden=True,
)

register_strategy_config(
    id="newstyle:2019-04-17",
    base="newstyle:2019-04-05",
    strategies=["message:v2"],
    delegates=["frame:v2", "single-exception:v2"],
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Experimental grouping algorithm (should not be used)
    """,
    hidden=True,
)

register_strategy_config(
    id="combined:2019-04-07",
    strategies=[
        "expect-ct:v1",
        "expect-staple:v1",
        "hpkp:v1",
        "csp:v1",
        "threads:v1",
        "stacktrace:v1nl",
        "chained-exception:v1nl",
        "template:v1",
        "message:v1",
    ],
    delegates=["frame:v1nl", "stacktrace:v1nl", "single-exception:v1nl"],
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Uses `newstyle:2019-04-05` for native platforms
        * Uses `legacy:2019-03-12` for all other platforms
    """,
    hidden=True,
)


# Grouping strategy for similarity
register_strategy_config(
    id="similarity:2020-07-23",
    base="newstyle:2019-10-29",
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Initial version
    """,
    hidden=True,
)
