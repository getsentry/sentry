from __future__ import annotations

import itertools
import logging
import re
from collections.abc import Generator
from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    call_with_variants,
    strategy,
)
from sentry.grouping.strategies.message import normalize_message_for_grouping
from sentry.grouping.strategies.utils import has_url_origin, remove_non_stacktrace_variants
from sentry.grouping.utils import hash_from_values
from sentry.interfaces.exception import Exception as ChainedException
from sentry.interfaces.exception import Mechanism, SingleException
from sentry.interfaces.stacktrace import Frame, Stacktrace
from sentry.interfaces.threads import Threads
from sentry.stacktraces.platform import get_behavior_family_for_platform

logger = logging.getLogger(__name__)

_ruby_erb_func = re.compile(r"__\d{4,}_\d{4,}$")
_basename_re = re.compile(r"[/\\]")

# OpenJDK auto-generated classes for reflection access:
#   sun.reflect.GeneratedSerializationConstructorAccessor123
#   sun.reflect.GeneratedConstructorAccessor456
# Note that this doesn't cover the following pattern for the sake of
# backward compatibility (to not to change the existing grouping):
#   sun.reflect.GeneratedMethodAccessor789
_java_reflect_enhancer_re = re.compile(
    r"""(sun\.reflect\.Generated(?:Serialization)?ConstructorAccessor)\d+""", re.X
)

# Java Spring specific anonymous classes.
# see: http://mydailyjava.blogspot.co.at/2013/11/cglib-missing-manual.html
_java_cglib_enhancer_re = re.compile(r"""(\$\$[\w_]+?CGLIB\$\$)[a-fA-F0-9]+(_[0-9]+)?""", re.X)

# Handle Javassist auto-generated classes and filenames:
#   com.example.api.entry.EntriesResource_$$_javassist_74
#   com.example.api.entry.EntriesResource_$$_javassist_seam_74
#   EntriesResource_$$_javassist_seam_74.java
_java_assist_enhancer_re = re.compile(r"""(\$\$_javassist)(?:_seam)?(?:_[0-9]+)?""", re.X)

# Clojure anon functions are compiled down to myapp.mymodule$fn__12345
_clojure_enhancer_re = re.compile(r"""(\$fn__)\d+""", re.X)

# Java specific anonymous CGLIB Enhancer classes.
# see: https://github.com/getsentry/sentry-java/issues/1018
#   com.example.api.OutboundController$$EnhancerByGuice$$ae46b1bf
#   com.example.api.OutboundController$EnhancerByGuice$ae46b1bf
#   com.example.api.OutboundController$$EnhancerByGuice$$ae46b1bf$$FastClassByGuice$$caceacd2
#   com.example.api.OutboundController$$EnhancerByGuice$$ae46b1bf$FastClassByGuice$caceacd2
#   com.example.api.OutboundController$EnhancerByGuice$ae46b1bf$FastClassByGuice$caceacd2
_java_enhancer_by_re = re.compile(r"""(\$\$?EnhancerBy[\w_]+?\$?\$)[a-fA-F0-9]+(_[0-9]+)?""", re.X)

# Java specific anonymous CGLIB FastClass classes.
# see: https://github.com/getsentry/sentry-java/issues/1018
#   com.example.api.OutboundController$$EnhancerByGuice$$ae46b1bf$$FastClassByGuice$$caceacd2
#   com.example.api.OutboundController$$EnhancerByGuice$$ae46b1bf$FastClassByGuice$caceacd2
#   com.example.api.OutboundController$EnhancerByGuice$ae46b1bf$FastClassByGuice$caceacd2
_java_fast_class_by_re = re.compile(
    r"""(\$\$?FastClassBy[\w_]+?\$?\$)[a-fA-F0-9]+(_[0-9]+)?""", re.X
)

# Java specific anonymous Hibernate classes.
# see: https://github.com/getsentry/sentry-java/issues/1018
#   com.example.model.User$HibernateProxy$oRWxjAWT
_java_hibernate_proxy_re = re.compile(r"""(\$\$?HibernateProxy\$?\$)\w+(_[0-9]+)?""", re.X)

# fields that need to be the same between frames for them to be considered
# recursive calls
RECURSION_COMPARISON_FIELDS = [
    "abs_path",
    "package",
    "module",
    "filename",
    "function",
    "lineno",
    "colno",
]

# TODO(markus)
StacktraceEncoderReturnValue = Any


def is_recursive_frames(frame1: Frame, frame2: Frame | None) -> bool:
    """
    Returns a boolean indicating whether frames are recursive calls.
    """
    if frame2 is None:
        return False

    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


def get_basename(string: str) -> str:
    """
    Returns best-effort basename of a string irrespective of platform.
    """
    return _basename_re.split(string)[-1]


def get_filename_component(
    abs_path: str,
    filename: str | None,
    platform: str | None,
    allow_file_origin: bool = False,
) -> BaseGroupingComponent:
    """Attempt to normalize filenames by detecting special filenames and by
    using the basename only.
    """
    if filename is None:
        return BaseGroupingComponent(id="filename")

    # Only use the platform independent basename for grouping and
    # lowercase it
    filename = _basename_re.split(filename)[-1].lower()
    filename_component = BaseGroupingComponent(
        id="filename",
        values=[filename],
    )

    if has_url_origin(abs_path, allow_file_origin=allow_file_origin):
        filename_component.update(contributes=False, hint="ignored because frame points to a URL")
    elif filename == "<anonymous>":
        filename_component.update(contributes=False, hint="anonymous filename discarded")
    elif filename == "[native code]":
        filename_component.update(contributes=False, hint="native code indicated by filename")
    elif platform == "java":
        new_filename = _java_assist_enhancer_re.sub(r"\1<auto>", filename)
        if new_filename != filename:
            filename_component.update(values=[new_filename], hint="cleaned javassist parts")
            filename = new_filename

    return filename_component


def get_module_component(
    abs_path: str | None,
    module: str | None,
    platform: str | None,
    context: GroupingContext,
) -> BaseGroupingComponent:
    """Given an absolute path, module and platform returns the module component
    with some necessary cleaning performed.
    """
    if module is None:
        return BaseGroupingComponent(id="module")

    module_component = BaseGroupingComponent(
        id="module",
        values=[module],
    )

    if platform == "javascript" and "/" in module and abs_path and abs_path.endswith(module):
        module_component.update(contributes=False, hint="ignored bad javascript module")
    elif platform == "java":
        if "$$Lambda$" in module:
            module_component.update(contributes=False, hint="ignored java lambda")
        if module[:35] == "sun.reflect.GeneratedMethodAccessor":
            module_component.update(
                values=["sun.reflect.GeneratedMethodAccessor"], hint="removed reflection marker"
            )
        elif module[:44] == "jdk.internal.reflect.GeneratedMethodAccessor":
            module_component.update(
                values=["jdk.internal.reflect.GeneratedMethodAccessor"],
                hint="removed reflection marker",
            )
        else:
            old_module = module
            module = _java_reflect_enhancer_re.sub(r"\1<auto>", module)
            module = _java_cglib_enhancer_re.sub(r"\1<auto>", module)
            module = _java_assist_enhancer_re.sub(r"\1<auto>", module)
            module = _clojure_enhancer_re.sub(r"\1<auto>", module)
            if context["java_cglib_hibernate_logic"]:
                module = _java_enhancer_by_re.sub(r"\1<auto>", module)
                module = _java_fast_class_by_re.sub(r"\1<auto>", module)
                module = _java_hibernate_proxy_re.sub(r"\1<auto>", module)
            if module != old_module:
                module_component.update(values=[module], hint="removed codegen marker")

    return module_component


def get_function_component(
    context: GroupingContext,
    function: str | None,
    raw_function: str | None,
    platform: str | None,
    sourcemap_used: bool = False,
    context_line_available: bool = False,
) -> BaseGroupingComponent:
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.
    """
    from sentry.stacktraces.functions import trim_function_name

    behavior_family = get_behavior_family_for_platform(platform)

    # We started trimming function names in csharp late which changed the
    # inputs to the grouping code.  Where previously the `function` attribute
    # contained the raw and untrimmed strings, it now contains the trimmed one
    # which is preferred by the frame component.  Because of this we tell the
    # component to prefer the raw function name over the function name for
    # csharp.
    # TODO: if a frame:v5 is added the raw function name should not be preferred
    # for csharp.
    prefer_raw_function_name = platform == "csharp"

    if prefer_raw_function_name:
        func = raw_function or function
    else:
        func = function or raw_function
        if not raw_function and function:
            func = trim_function_name(func, platform)

    if not func:
        return BaseGroupingComponent(id="function")

    function_component = BaseGroupingComponent(
        id="function",
        values=[func],
    )

    if platform == "ruby":
        if func.startswith("block "):
            function_component.update(values=["block"], hint="ruby block")
        else:
            new_function = _ruby_erb_func.sub("", func)
            if new_function != func:
                function_component.update(
                    values=[new_function], hint="removed generated erb template suffix"
                )

    elif platform == "php":
        if func.startswith(("[Anonymous", "class@anonymous\x00")):
            function_component.update(contributes=False, hint="ignored anonymous function")
        if context["php_detect_anonymous_classes"] and func.startswith("class@anonymous"):
            new_function = func.rsplit("::", 1)[-1]
            if new_function != func:
                function_component.update(values=[new_function], hint="anonymous class method")

    elif platform == "java":
        if func.startswith("lambda$"):
            function_component.update(contributes=False, hint="ignored lambda function")

    elif behavior_family == "native" and func in ("<redacted>", "<unknown>"):
        function_component.update(contributes=False, hint="ignored unknown function")

    elif context["javascript_fuzzing"] and behavior_family == "javascript":
        # This changes Object.foo or Foo.foo into foo so that we can
        # resolve some common cross browser differences
        new_function = func.rsplit(".", 1)[-1]
        if new_function != func:
            function_component.update(values=[new_function], hint="trimmed javascript function")

        # if a sourcemap was used for this frame and we know that we can
        # use the context line information we no longer want to use the
        # function name.  The reason for this is that function names in
        # sourcemaps are unreliable by the nature of sourcemaps and thus a
        # bad indicator for grouping.
        if sourcemap_used and context_line_available:
            function_component.update(
                contributes=False,
                hint="ignored because sourcemap used and context line available",
            )

    return function_component


@strategy(
    ids=["frame:v1"],
    interface=Frame,
)
def frame(
    interface: Frame, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    frame = interface
    platform = frame.platform or event.platform

    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    filename_component = get_filename_component(
        frame.abs_path, frame.filename, platform, allow_file_origin=context["javascript_fuzzing"]
    )

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename if it contributes
    module_component = get_module_component(frame.abs_path, frame.module, platform, context)
    if module_component.contributes and filename_component.contributes:
        filename_component.update(contributes=False, hint="module takes precedence")

    context_line_component = None

    # If we are allowed to use the contextline we add it now.
    if platform in context["contextline_platforms"]:
        context_line_component = get_contextline_component(
            frame,
            platform,
            function=frame.function,
            context=context,
        )

    context_line_available = bool(context_line_component and context_line_component.contributes)

    function_component = get_function_component(
        context=context,
        function=frame.function,
        raw_function=frame.raw_function,
        platform=platform,
        sourcemap_used=frame.data and frame.data.get("sourcemap") is not None,
        context_line_available=context_line_available,
    )

    values = [module_component, filename_component, function_component]
    if context_line_component is not None:
        values.append(context_line_component)

    rv = BaseGroupingComponent(id="frame", values=values)

    # if we are in javascript fuzzing mode we want to disregard some
    # frames consistently.  These force common bad stacktraces together
    # to have a common hash at the cost of maybe skipping over frames that
    # would otherwise be useful.
    if context["javascript_fuzzing"] and get_behavior_family_for_platform(platform) == "javascript":
        func = frame.raw_function or frame.function
        if func:
            func = func.rsplit(".", 1)[-1]
        # special case empty functions not to have a hint
        if not func:
            function_component.update(contributes=False)
        elif func in (
            "?",
            "<anonymous function>",
            "<anonymous>",
            "Anonymous function",
        ) or func.endswith("/<"):
            function_component.update(contributes=False, hint="ignored unknown function name")
        if (func == "eval") or frame.abs_path in (
            "[native code]",
            "native code",
            "eval code",
            "<anonymous>",
        ):
            rv.update(contributes=False, hint="ignored low quality javascript frame")

    if context["is_recursion"]:
        rv.update(contributes=False, hint="ignored due to recursion")

    return {context["variant"]: rv}


def get_contextline_component(
    frame: Frame, platform: str | None, function: str, context: GroupingContext
) -> BaseGroupingComponent:
    """Returns a contextline component.  The caller's responsibility is to
    make sure context lines are only used for platforms where we trust the
    quality of the sourcecode.  It does however protect against some bad
    JavaScript environments based on origin checks.
    """
    line = " ".join((frame.context_line or "").expandtabs(2).split())
    if not line:
        return BaseGroupingComponent(id="context-line")

    component = BaseGroupingComponent(
        id="context-line",
        values=[line],
    )
    if line:
        if len(frame.context_line) > 120:
            component.update(hint="discarded because line too long", contributes=False)
        elif get_behavior_family_for_platform(platform) == "javascript":
            if context["with_context_line_file_origin_bug"]:
                if has_url_origin(frame.abs_path, allow_file_origin=True):
                    component.update(hint="discarded because from URL origin", contributes=False)
            elif not function and has_url_origin(frame.abs_path):
                component.update(
                    hint="discarded because from URL origin and no function", contributes=False
                )

    return component


@strategy(ids=["stacktrace:v1"], interface=Stacktrace, score=1800)
def stacktrace(
    interface: Stacktrace, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    assert context["variant"] is None

    return call_with_variants(
        _single_stacktrace_variant,
        ["!system", "app"],
        interface,
        event=event,
        context=context,
        meta=meta,
    )


def _single_stacktrace_variant(
    stacktrace: Stacktrace, event: Event, context: GroupingContext, meta: dict[str, Any]
) -> ReturnedVariants:
    variant = context["variant"]

    frames = stacktrace.frames

    values = []
    prev_frame = None
    frames_for_filtering = []
    found_in_app_frame = False

    for frame in frames:
        with context:
            context["is_recursion"] = is_recursive_frames(frame, prev_frame)
            frame_component = context.get_single_grouping_component(frame, event=event, **meta)

        if variant == "app":
            if frame.in_app:
                found_in_app_frame = True
            else:
                # We have to do this here (rather than it being done in the rust enhancer) because
                # the rust enhancer doesn't know about system vs app variants
                frame_component.update(contributes=False, hint="non app frame")

        values.append(frame_component)
        frames_for_filtering.append(frame.get_raw_data())
        prev_frame = frame

    # Special case for JavaScript where we want to ignore single frame
    # stacktraces in certain cases where those would be of too low quality
    # for grouping.
    if (
        len(frames) == 1
        and values[0].contributes
        and get_behavior_family_for_platform(frames[0].platform or event.platform) == "javascript"
        and not frames[0].function
        and frames[0].is_url()
    ):
        values[0].update(contributes=False, hint="ignored single non-URL JavaScript frame")

    main_variant, _ = context.config.enhancements.assemble_stacktrace_component(
        values,
        frames_for_filtering,
        event.platform,
        exception_data=context["exception_data"],
    )

    # TODO: Ideally this hint would get set by the rust enhancer. Right now the only stacktrace
    # component hint it sets is one about ignoring stacktraces with contributing frames because the
    # number of contributing frames isn't big enough. In that case it also sets `contributes` to
    # false, as it does when there are no contributing frames. In this latter case it doesn't set a
    # hint, though, so we do it here.
    if not main_variant.hint and not main_variant.contributes:
        if len(frames) == 0:
            frames_description = "frames"
        elif variant == "system":
            frames_description = "contributing frames"
        elif variant == "app":
            # If there are in-app frames but the stacktrace nontheless doesn't contribute, it must
            # be because all of the frames got marked as non-contributing in the enhancer
            if found_in_app_frame:
                frames_description = "contributing frames"
            else:
                frames_description = "in-app frames"

        main_variant.hint = f"ignored because it contains no {frames_description}"

    return {variant: main_variant}


@stacktrace.variant_processor
def stacktrace_variant_processor(
    variants: ReturnedVariants, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return remove_non_stacktrace_variants(variants)


@strategy(
    ids=["single-exception:v1"],
    interface=SingleException,
)
def single_exception(
    interface: SingleException, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    type_component = BaseGroupingComponent(
        id="type",
        values=[interface.type] if interface.type else [],
    )
    system_type_component = type_component.shallow_copy()

    ns_error_component = None

    if interface.mechanism:
        if interface.mechanism.synthetic:
            # Ignore synthetic exceptions as they are produced from platform
            # specific error codes.
            #
            # For example there can be crashes with EXC_ACCESS_VIOLATION_* on Windows with
            # the same exact stacktrace as a crash with EXC_BAD_ACCESS on macOS.
            #
            # Do not update type component of system variant, such that regex
            # can be continuously modified without unnecessarily creating new
            # groups.
            type_component.update(contributes=False, hint="ignored because exception is synthetic")
            system_type_component.update(
                contributes=False, hint="ignored because exception is synthetic"
            )
        if interface.mechanism.meta and "ns_error" in interface.mechanism.meta:
            ns_error_component = BaseGroupingComponent(
                id="ns-error",
                values=[
                    interface.mechanism.meta["ns_error"].get("domain"),
                    interface.mechanism.meta["ns_error"].get("code"),
                ],
            )

    if interface.stacktrace is not None:
        with context:
            context["exception_data"] = interface.to_json()
            stacktrace_variants = context.get_grouping_component(
                interface.stacktrace, event=event, **meta
            )
    else:
        stacktrace_variants = {
            "app": BaseGroupingComponent(id="stacktrace"),
        }

    rv = {}

    for variant, stacktrace_component in stacktrace_variants.items():
        values = [
            stacktrace_component,
            system_type_component if variant == "system" else type_component,
        ]

        if ns_error_component is not None:
            values.append(ns_error_component)

        if context["with_exception_value_fallback"]:
            value_component = BaseGroupingComponent(
                id="value",
            )

            raw = interface.value
            if raw is not None:
                favors_other_component = stacktrace_component.contributes or (
                    ns_error_component is not None and ns_error_component.contributes
                )
                normalized = normalize_message_for_grouping(
                    raw, event, share_analytics=(not favors_other_component)
                )
                hint = "stripped event-specific values" if raw != normalized else None
                if normalized:
                    value_component.update(values=[normalized], hint=hint)

            if stacktrace_component.contributes and value_component.contributes:
                value_component.update(
                    contributes=False,
                    hint="ignored because stacktrace takes precedence",
                )

            if (
                ns_error_component is not None
                and ns_error_component.contributes
                and value_component.contributes
            ):
                value_component.update(
                    contributes=False,
                    hint="ignored because ns-error info takes precedence",
                )

            values.append(value_component)

        rv[variant] = BaseGroupingComponent(id="exception", values=values)

    return rv


@strategy(ids=["chained-exception:v1"], interface=ChainedException, score=2000)
def chained_exception(
    interface: ChainedException, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    # Get all the exceptions to consider.
    all_exceptions = interface.exceptions()

    # Get the grouping components for all exceptions up front, as we'll need them in a few places and only want to compute them once.
    exception_components = {
        id(exception): context.get_grouping_component(exception, event=event, **meta)
        for exception in all_exceptions
    }

    # Filter the exceptions according to rules for handling exception groups.
    try:
        exceptions = filter_exceptions_for_exception_groups(
            all_exceptions, exception_components, event
        )
    except Exception:
        # We shouldn't have exceptions here. But if we do, just record it and continue with the original list.
        # TODO: Except we do, as it turns out. See https://github.com/getsentry/sentry/issues/73592.
        logging.exception(
            "Failed to filter exceptions for exception groups. Continuing with original list."
        )
        exceptions = all_exceptions

    main_exception_id = determine_main_exception_id(exceptions)
    if main_exception_id:
        event.data["main_exception_id"] = main_exception_id

    # Case 1: we have a single exception, use the single exception
    # component directly to avoid a level of nesting
    if len(exceptions) == 1:
        return exception_components[id(exceptions[0])]

    # Case 2: produce a component for each chained exception
    by_name: dict[str, list[BaseGroupingComponent]] = {}

    for exception in exceptions:
        for name, component in exception_components[id(exception)].items():
            by_name.setdefault(name, []).append(component)

    rv = {}

    for name, component_list in by_name.items():
        rv[name] = BaseGroupingComponent(
            id="chained-exception",
            values=component_list,
        )

    return rv


# See https://github.com/getsentry/rfcs/blob/main/text/0079-exception-groups.md#sentry-issue-grouping
def filter_exceptions_for_exception_groups(
    exceptions: list[SingleException],
    exception_components: dict[int, ReturnedVariants],
    event: Event,
) -> list[SingleException]:
    # This function only filters exceptions if there are at least two exceptions.
    if len(exceptions) <= 1:
        return exceptions

    # Reconstruct the tree of exceptions if the required data is present.
    class ExceptionTreeNode:
        def __init__(
            self,
            exception: SingleException | None = None,
            children: list[SingleException] | None = None,
        ):
            self.exception = exception
            self.children = children if children else []

    exception_tree: dict[int, ExceptionTreeNode] = {}
    for exception in reversed(exceptions):
        mechanism: Mechanism = exception.mechanism
        if mechanism and mechanism.exception_id is not None:
            node = exception_tree.setdefault(
                mechanism.exception_id, ExceptionTreeNode()
            ).exception = exception
            node.exception = exception
            if mechanism.parent_id is not None:
                parent_node = exception_tree.setdefault(mechanism.parent_id, ExceptionTreeNode())
                parent_node.children.append(exception)
        else:
            # At least one exception is missing mechanism ids, so we can't continue with the filter.
            # Exit early to not waste perf.
            return exceptions

    # This gets the child exceptions for an exception using the exception_id from the mechanism.
    # That data is guaranteed to exist at this point.
    def get_child_exceptions(exception: SingleException) -> list[SingleException]:
        exception_id = exception.mechanism.exception_id
        node = exception_tree.get(exception_id)
        return node.children if node else []

    # This recursive generator gets the "top-level exceptions", and is used below.
    # "Top-level exceptions are those that are the first descendants of the root that are not exception groups.
    # For examples, see https://github.com/getsentry/rfcs/blob/main/text/0079-exception-groups.md#sentry-issue-grouping
    def get_top_level_exceptions(
        exception: SingleException,
    ) -> Generator[SingleException]:
        if exception.mechanism.is_exception_group:
            children = get_child_exceptions(exception)
            yield from itertools.chain.from_iterable(
                get_top_level_exceptions(child) for child in children
            )
        else:
            yield exception

    # This recursive generator gets the "first-path" of exceptions, and is used below.
    # The first path follows from the root to a leaf node, but only following the first child of each node.
    def get_first_path(exception: SingleException) -> Generator[SingleException]:
        yield exception
        children = get_child_exceptions(exception)
        if children:
            yield from get_first_path(children[0])

    # Traverse the tree recursively from the root exception to get all "top-level exceptions" and sort for consistency.
    if exception_tree[0].exception:
        top_level_exceptions = sorted(
            get_top_level_exceptions(exception_tree[0].exception),
            key=lambda exception: str(exception.type),
            reverse=True,
        )

    # Figure out the distinct top-level exceptions, grouping by the hash of the grouping component values.
    distinct_top_level_exceptions = [
        next(group)
        for _, group in itertools.groupby(
            top_level_exceptions,
            key=lambda exception: hash_from_values(exception_components[id(exception)].values())
            or "",
        )
    ]

    # If there's only one distinct top-level exception in the group,
    # use it and its first-path children, but throw out the exception group and any copies.
    # For example, Group<['Da', 'Da', 'Da']> should just be treated as a single 'Da'.
    # We'll also set the main_exception_id, which is used in the extract_metadata function
    # in src/sentry/eventtypes/error.py - which will ensure the issue is titled by this
    # item rather than the exception group.
    if len(distinct_top_level_exceptions) == 1:
        main_exception = distinct_top_level_exceptions[0]
        event.data["main_exception_id"] = main_exception.mechanism.exception_id
        return list(get_first_path(main_exception))

    # When there's more than one distinct top-level exception, return one of each of them AND the root exception group.
    # NOTE: This deviates from the original RFC, because finding a common ancestor that shares
    # one of each top-level exception that is _not_ the root is overly complicated.
    # Also, it's more likely the stack trace of the root exception will be more meaningful
    # than one of an inner exception group.
    if exception_tree[0].exception:
        distinct_top_level_exceptions.append(exception_tree[0].exception)
    return distinct_top_level_exceptions


@chained_exception.variant_processor
def chained_exception_variant_processor(
    variants: ReturnedVariants, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return remove_non_stacktrace_variants(variants)


@strategy(ids=["threads:v1"], interface=Threads, score=1900)
def threads(
    interface: Threads, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    thread_variants = _filtered_threads(
        [thread for thread in interface.values if thread.get("crashed")], event, context, meta
    )
    if thread_variants is not None:
        return thread_variants

    thread_variants = _filtered_threads(
        [thread for thread in interface.values if thread.get("current")], event, context, meta
    )
    if thread_variants is not None:
        return thread_variants

    thread_variants = _filtered_threads(interface.values, event, context, meta)
    if thread_variants is not None:
        return thread_variants

    return {
        "app": BaseGroupingComponent(
            id="threads",
            contributes=False,
            hint=(
                "ignored because does not contain exactly one crashing, "
                "one current or just one thread, instead contains %s threads"
                % len(interface.values)
            ),
        )
    }


def _filtered_threads(
    threads: list[dict[str, Any]], event: Event, context: GroupingContext, meta: dict[str, Any]
) -> ReturnedVariants | None:
    if len(threads) != 1:
        return None

    stacktrace = threads[0].get("stacktrace")
    if not stacktrace:
        return {
            "app": BaseGroupingComponent(
                id="threads", contributes=False, hint="thread has no stacktrace"
            )
        }

    rv = {}

    for name, stacktrace_component in context.get_grouping_component(
        stacktrace, event=event, **meta
    ).items():
        rv[name] = BaseGroupingComponent(id="threads", values=[stacktrace_component])

    return rv


@threads.variant_processor
def threads_variant_processor(
    variants: ReturnedVariants, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    return remove_non_stacktrace_variants(variants)


REACT_ERRORS_WITH_CAUSE = [
    "There was an error during concurrent rendering but React was able to recover by instead synchronously rendering the entire root.",
    "There was an error while hydrating but React was able to recover by instead client rendering from the nearest Suspense boundary.",
]


def react_error_with_cause(exceptions: list[SingleException]) -> int | None:
    main_exception_id = None
    # Starting with React 19, errors can also contain a cause error which
    # is useful to display instead of the default message
    if (
        exceptions[0].type == "Error"
        and exceptions[0].value in REACT_ERRORS_WITH_CAUSE
        and exceptions[-1].mechanism.source == "cause"
    ):
        main_exception_id = exceptions[-1].mechanism.exception_id
    return main_exception_id


def determine_main_exception_id(exceptions: list[SingleException]) -> int | None:
    MAIN_EXCEPTION_ID_FUNCS = [
        react_error_with_cause,
    ]
    main_exception_id = None
    for func in MAIN_EXCEPTION_ID_FUNCS:
        main_exception_id = func(exceptions)
        if main_exception_id is not None:
            break

    return main_exception_id
