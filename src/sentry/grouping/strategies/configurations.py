from sentry.grouping.strategies.base import (
    RISK_LEVEL_HIGH,
    RISK_LEVEL_LOW,
    RISK_LEVEL_MEDIUM,
    create_strategy_configuration,
)

# The full mapping of all known configurations.
CONFIGURATIONS = {}

# The implied base strategy *every* strategy inherits from if no
# base is defined.
BASE_STRATEGY = create_strategy_configuration(
    None,
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
    initial_context={
        # This key in the context tells the system which variant should
        # be produced.  TODO: phase this out.
        "variant": None,
        # This is a flag that can be used by any delegate to respond to
        # a detected recursion.  This is currently used by the frame
        # strategy to disable itself.  Recursion is detected by the outer
        # strategy.
        "is_recursion": False,
        # This turns on the automatic message trimming by the message
        # strategy.
        "trim_message": False,
        # newstyle: enables the legacy function logic.  This is only used
        # by the newstyle:2019-04-05 strategy.  Once this is no longer used
        # this can go away entirely.
        "legacy_function_logic": False,
        # newstyle: turns on some javascript fuzzing features.
        "javascript_fuzzing": False,
        # newstyle: platforms for which context line should be taken into
        # account when grouping.
        "contextline_platforms": (),
        # newstyle: this detects anonymous classes in PHP code.
        "php_detect_anonymous_classes": False,
        # newstyle: turns on a bug that was present in some variants
        "with_context_line_file_origin_bug": False,
        # newstyle: turns on falling back to exception values when there
        # is no stacktrace.
        "with_exception_value_fallback": False,
        # Whether the strategy should produce special variants that are
        # considered for hierarchical grouping (see HIERARCHICAL_VARIANTS
        # constant)
        "hierarchical_grouping": False,
        # Stacktrace is produced in the context of this exception
        "exception_data": None,
        # Whether to discard filenames of native events for grouping if
        # function is present.
        "discard_native_filename": False,
        # Use the `package` component of a frame as fallback where other
        # information would be used but is not available.
        "use_package_fallback": False,
        # Remove platform differences in native frames
        "native_fuzzing": False,
        # Ignore exception types for native if they are platform specific error
        # codes. Normally SDKs are supposed to disable error-type grouping with
        # the `synthetic` flag in the event, but a lot of error types we can
        # also detect on the backend.
        "detect_synthetic_exception_types": False,
    },
)


def register_strategy_config(id, **kwargs):
    if kwargs.get("base") is not None:
        kwargs["base"] = CONFIGURATIONS[kwargs["base"]]
    else:
        kwargs["base"] = BASE_STRATEGY
    rv = create_strategy_configuration(id, **kwargs)
    CONFIGURATIONS[rv.id] = rv
    return rv


# Legacy groupings
#
# These we do not plan on changing much, but bugfixes here might still go
# into new grouping versions.

register_strategy_config(
    id="legacy:2019-03-12",
    strategies=[
        "threads:legacy",
        "stacktrace:legacy",
        "chained-exception:legacy",
    ],
    delegates=["frame:legacy", "stacktrace:legacy", "single-exception:legacy"],
    changelog="""
        * Traditional grouping algorithm
        * Some known weaknesses with regards to grouping of native frames
    """,
    initial_context={
        "trim_message": False,
    },
    enhancements_base="legacy:2019-03-12",
)

# Simple newstyle grouping
#
# This is a grouping strategy that applies very simple rules and will
# become the new default at one point.  Optimized for native and
# javascript but works for all platforms.

register_strategy_config(
    id="newstyle:2019-05-08",
    risk=RISK_LEVEL_HIGH,
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
    initial_context={
        "javascript_fuzzing": True,
        "contextline_platforms": ("javascript", "node", "python", "php", "ruby"),
        "with_context_line_file_origin_bug": True,
        "trim_message": True,
        "with_exception_value_fallback": True,
    },
    enhancements_base="common:2019-03-23",
)

register_strategy_config(
    id="newstyle:2019-10-29",
    base="newstyle:2019-05-08",
    risk=RISK_LEVEL_MEDIUM,
    changelog="""
        * Better rules for when to take context lines into account for
          JavaScript platforms for grouping purposes.
        * Better support for PHP7 anonymous classes.
    """,
    initial_context={
        "php_detect_anonymous_classes": True,
        "with_context_line_file_origin_bug": False,
    },
)

register_strategy_config(
    id="mobile:2021-02-12",
    base="newstyle:2019-10-29",
    # XXX(markus): Low risk because fallback grouping is supposed to take care
    # of this, for the hierarchical grouping rollout. Really we should get rid
    # of strategy risks entirely.
    risk=RISK_LEVEL_LOW,
    changelog="""
        * Groups by a single frame to create fewer duplicate issues, usually
          the top in-app frame.
        * Provides a [breakdown of issues](https://docs.sentry.io/product/data-management-settings/event-grouping/grouping-breakdown/)
          into unique call hierarchies in the _Grouping_ tab.
        * Filenames in native events are no longer used because they differ
          between platforms, and package (dll basename) is used as fallback for a
          frame if a function name is not available.
        * For mobile and native projects: Error codes on crash signals are now
          ignored to unify platform differences.
        * For native projects: Anonymous namespaces from different compilers now
          no longer result in different issues.
    """,
    initial_context={
        "hierarchical_grouping": True,
        "discard_native_filename": True,
        "use_package_fallback": True,
        "native_fuzzing": True,
        "detect_synthetic_exception_types": True,
    },
    enhancements_base="mobile:2021-04-02",
)


# Deprecated strategies
#
# These should not be used.  They are experiments which should be phased out
# once there are no projects on them.

register_strategy_config(
    id="newstyle:2019-04-05",
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Experimental grouping algorithm (should not be used)
    """,
    hidden=True,
    initial_context={
        "legacy_function_logic": True,
    },
    enhancements_base="common:2019-03-23",
)

register_strategy_config(
    id="newstyle:2019-04-17",
    base="newstyle:2019-04-05",
    risk=RISK_LEVEL_HIGH,
    changelog="""
        * Experimental grouping algorithm (should not be used)
    """,
    hidden=True,
    initial_context={
        "legacy_function_logic": False,
        "trim_message": True,
        "with_exception_value_fallback": True,
    },
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
