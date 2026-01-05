from __future__ import annotations

import itertools
import logging
import re
from collections import Counter
from collections.abc import Generator
from typing import TYPE_CHECKING, Any

from sentry.grouping.component import (
    ChainedExceptionGroupingComponent,
    ContextLineGroupingComponent,
    ErrorTypeGroupingComponent,
    ErrorValueGroupingComponent,
    ExceptionGroupingComponent,
    ExceptionGroupingComponentChildren,
    FilenameGroupingComponent,
    FrameGroupingComponent,
    FunctionGroupingComponent,
    ModuleGroupingComponent,
    NSErrorCodeGroupingComponent,
    NSErrorDomainGroupingComponent,
    NSErrorGroupingComponent,
    StacktraceGroupingComponent,
    ThreadsGroupingComponent,
)
from sentry.grouping.strategies.base import (
    ComponentsByVariant,
    GroupingContext,
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
from sentry.utils.safe import get_path

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


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


def _is_recursive_frame(frame: Frame, previous_frame: Frame | None) -> bool:
    """
    Return a boolean indicating whether the given frame is a repeat of the frame before it and
    therefore represents a recursive call.
    """
    if previous_frame is None:
        return False

    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame, field, None) != getattr(previous_frame, field, None):
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
) -> FilenameGroupingComponent:
    """Attempt to normalize filenames by detecting special filenames and by
    using the basename only.
    """
    if filename is None:
        return FilenameGroupingComponent()

    # Only use the platform independent basename for grouping and
    # lowercase it
    filename = _basename_re.split(filename)[-1].lower()
    filename_component = FilenameGroupingComponent(values=[filename])

    if has_url_origin(abs_path, files_count_as_urls=False):
        filename_component.update(contributes=False, hint="ignored because frame points to a URL")
    elif filename == "<anonymous>":
        filename_component.update(contributes=False, hint="ignored because filename is anonymous")
    elif filename == "[native code]":
        filename_component.update(
            contributes=False, hint="ignored because filename suggests native code"
        )
    elif platform == "java":
        new_filename = _java_assist_enhancer_re.sub(r"\1<auto>", filename)
        if new_filename != filename:
            filename_component.update(values=[new_filename], hint="cleaned javassist parts")

    return filename_component


def get_module_component(
    abs_path: str | None,
    module: str | None,
    platform: str | None,
    context: GroupingContext,
) -> ModuleGroupingComponent:
    """Given an absolute path, module and platform returns the module component
    with some necessary cleaning performed.
    """
    if module is None:
        return ModuleGroupingComponent()

    module_component = ModuleGroupingComponent(values=[module])

    if platform == "javascript" and "/" in module and abs_path and abs_path.endswith(module):
        module_component.update(contributes=False, hint="ignored bad javascript module")
    elif platform == "java":
        if "$$Lambda$" in module:
            module_component.update(contributes=False, hint="ignored java lambda")
        if module.startswith("sun.reflect.GeneratedMethodAccessor"):
            module_component.update(
                values=["sun.reflect.GeneratedMethodAccessor"], hint="removed reflection marker"
            )
        elif module.startswith("jdk.internal.reflect.GeneratedMethodAccessor"):
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
) -> FunctionGroupingComponent:
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
        return FunctionGroupingComponent()

    function_component = FunctionGroupingComponent(values=[func])

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
        if func.startswith("class@anonymous"):
            new_function = func.rsplit("::", 1)[-1]
            if new_function != func:
                function_component.update(values=[new_function], hint="anonymous class method")

    elif platform == "java":
        if func.startswith("lambda$"):
            function_component.update(contributes=False, hint="ignored lambda function")

    elif behavior_family == "native" and func in ("<redacted>", "<unknown>"):
        function_component.update(contributes=False, hint="ignored unknown function")

    elif behavior_family == "javascript":
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
    interface: Frame, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    frame = interface
    platform = frame.platform or event.platform
    variant_name = context["variant_name"]
    assert variant_name is not None

    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    filename_component = get_filename_component(frame.abs_path, frame.filename, platform)

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename if it contributes
    module_component = get_module_component(frame.abs_path, frame.module, platform, context)
    if module_component.contributes and filename_component.contributes:
        filename_component.update(contributes=False, hint="ignored because module takes precedence")

    if frame.context_line and platform in context["contextline_platforms"]:
        context_line_component = get_contextline_component(
            frame,
            platform,
            function=frame.function,
            context=context,
        )
    else:
        context_line_component = None

    function_component = get_function_component(
        context=context,
        function=frame.function,
        raw_function=frame.raw_function,
        platform=platform,
        sourcemap_used=frame.data and frame.data.get("sourcemap") is not None,
        context_line_available=bool(context_line_component and context_line_component.contributes),
    )

    values: list[
        ContextLineGroupingComponent
        | FilenameGroupingComponent
        | FunctionGroupingComponent
        | ModuleGroupingComponent
    ] = [module_component, filename_component, function_component]
    if context_line_component is not None:
        values.append(context_line_component)

    frame_component = FrameGroupingComponent(values=values, in_app=frame.in_app)

    # Ignore JS functions and/or whole frames which are just noise
    if get_behavior_family_for_platform(platform) == "javascript":
        func = frame.raw_function or frame.function
        if func:
            # Strip leading namespacing, i.e., turn `some.module.path.someFunction` into
            # `someFunction` and `someObject.someMethod` into `someMethod`
            func = func.rsplit(".", 1)[-1]

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
            frame_component.update(contributes=False, hint="ignored low quality javascript frame")

    return {variant_name: frame_component}


def get_contextline_component(
    frame: Frame, platform: str | None, function: str, context: GroupingContext
) -> ContextLineGroupingComponent:
    """Returns a contextline component.  The caller's responsibility is to
    make sure context lines are only used for platforms where we trust the
    quality of the sourcecode.  It does however protect against some bad
    JavaScript environments based on origin checks.
    """
    # Normalize all whitespace into single spaces
    raw_line = frame.context_line or ""
    line = " ".join(raw_line.split())

    if not line:
        return ContextLineGroupingComponent()

    context_line_component = ContextLineGroupingComponent(values=[line])

    if len(frame.context_line) > 120:
        context_line_component.update(hint="ignored because line is too long", contributes=False)
    elif (
        get_behavior_family_for_platform(platform) == "javascript"
        and not function
        and has_url_origin(frame.abs_path, files_count_as_urls=True)
    ):
        context_line_component.update(
            hint="ignored because file path is a URL and function name is missing",
            contributes=False,
        )

    return context_line_component


@strategy(ids=["stacktrace:v1"], interface=Stacktrace, score=1800)
def stacktrace(
    interface: Stacktrace, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    assert context.get("variant_name") is None

    stacktrace_components_by_variant = call_with_variants(
        _single_stacktrace_variant,
        ["!app", "system"],
        interface,
        event=event,
        context=context,
        kwargs=kwargs,
    )

    # Tally the number of each type of frame in the stacktrace. This will help with getting the hint
    # now, and later on, this will allow us to both collect metrics and use the information in
    # decisions about whether to send the event to Seer. Only the system variant can see system
    # frames as contributing, so we use it to get the counts.
    app_stacktrace_component = stacktrace_components_by_variant.get("!app")
    system_stacktrace_component = stacktrace_components_by_variant.get("system")
    frame_counts: Counter[str] = Counter()
    total_in_app_frames = 0
    total_contributing_frames = 0

    if app_stacktrace_component and system_stacktrace_component:  # Mypy appeasement; always true
        # Do the tallying
        for frame_component in system_stacktrace_component.values:
            if frame_component.in_app:
                frame_type = "in_app"
                total_in_app_frames += 1
            else:
                frame_type = "system"

            if frame_component.contributes:
                contribution_descriptor = "contributing"
                total_contributing_frames += 1
            else:
                contribution_descriptor = "non_contributing"

            key = f"{frame_type}_{contribution_descriptor}_frames"
            frame_counts[key] += 1

        app_stacktrace_component.frame_counts = frame_counts
        system_stacktrace_component.frame_counts = frame_counts

        # Find all the cases where we might ignore the stacktrace, and set appropriate hints
        no_frames_hint = "ignored because it contains no frames"
        no_in_app_frames_hint = "ignored because it contains no in-app frames"
        no_contributing_frames_hint = "ignored because it contains no contributing frames"

        if not system_stacktrace_component.values:  # No frames at all
            system_stacktrace_component.update(contributes=False, hint=no_frames_hint)
            app_stacktrace_component.update(contributes=False, hint=no_frames_hint)
        else:
            if total_contributing_frames == 0:
                system_stacktrace_component.update(
                    contributes=False, hint=no_contributing_frames_hint
                )

            if total_in_app_frames == 0:
                app_stacktrace_component.update(contributes=False, hint=no_in_app_frames_hint)
            elif frame_counts["in_app_contributing_frames"] == 0:
                app_stacktrace_component.update(contributes=False, hint=no_contributing_frames_hint)

    return stacktrace_components_by_variant


def _single_stacktrace_variant(
    stacktrace: Stacktrace, event: Event, context: GroupingContext, kwargs: dict[str, Any]
) -> ComponentsByVariant:
    variant_name = context["variant_name"]
    assert variant_name is not None

    frames = stacktrace.frames

    frame_components = []
    prev_frame = None
    raw_frames = []

    for frame in frames:
        frame_component = context.get_single_grouping_component(frame, event=event, **kwargs)
        if _is_recursive_frame(frame, prev_frame):
            frame_component.update(contributes=False, hint="ignored due to recursion")

        if variant_name == "app" and not frame.in_app:
            frame_component.update(contributes=False)

        frame_components.append(frame_component)
        raw_frames.append(frame.get_raw_data())
        prev_frame = frame

    # Special case for JavaScript where we want to ignore single frame
    # stacktraces in certain cases where those would be of too low quality
    # for grouping.
    if (
        len(frames) == 1
        and frame_components[0].contributes
        and get_behavior_family_for_platform(frames[0].platform or event.platform) == "javascript"
        and not frames[0].function
    ):
        should_ignore_frame = has_url_origin(frames[0].abs_path, files_count_as_urls=True)
        if should_ignore_frame:
            frame_components[0].update(
                contributes=False, hint="ignored single non-URL JavaScript frame"
            )

    stacktrace_component = context.config.enhancements.assemble_stacktrace_component(
        variant_name,
        frame_components,
        raw_frames,
        event.platform,
        exception_data=context.get("exception_data"),
    )

    # This context value is set by the grouping info endpoint, so that the frame order of the
    # stacktraces we show in the issue details page's grouping info section matches the frame order
    # of the main stacktraces on the page.
    if context.get("reverse_stacktraces"):
        stacktrace_component.reverse_when_serializing = True

    return {variant_name: stacktrace_component}


@stacktrace.variant_processor
def stacktrace_variant_processor(
    variants: ComponentsByVariant, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    return remove_non_stacktrace_variants(variants)


@strategy(
    ids=["single-exception:v1"],
    interface=SingleException,
)
def single_exception(
    interface: SingleException, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    exception = interface

    type_component = ErrorTypeGroupingComponent(
        values=[exception.type] if exception.type else [],
    )

    ns_error_component = None

    if exception.mechanism:
        if exception.mechanism.synthetic:
            # Ignore the error type for synthetic exceptions as it can vary by platform and doesn't
            # actually carry any meaning with respect to what went wrong. (Synthetic exceptions
            # are dummy excepttions created by the SDK in order to harvest a stacktrace.)
            type_component.update(contributes=False, hint="ignored because exception is synthetic")

        if exception.mechanism.meta and "ns_error" in exception.mechanism.meta:
            ns_error = exception.mechanism.meta["ns_error"]
            ns_error_component = NSErrorGroupingComponent(
                values=[
                    NSErrorDomainGroupingComponent(values=[ns_error.get("domain")]),
                    NSErrorCodeGroupingComponent(values=[ns_error.get("code")]),
                ]
            )

    if exception.stacktrace is not None:
        with context:
            context["exception_data"] = exception.to_json()
            stacktrace_components_by_variant: dict[str, StacktraceGroupingComponent] = (
                context.get_grouping_components_by_variant(
                    exception.stacktrace, event=event, **kwargs
                )
            )
    else:
        stacktrace_components_by_variant = {
            "!app": StacktraceGroupingComponent(),
        }

    exception_components_by_variant = {}

    for variant_name, stacktrace_component in stacktrace_components_by_variant.items():
        value_component = ErrorValueGroupingComponent()

        raw = exception.value
        if raw is not None:
            normalized = normalize_message_for_grouping(raw, event)
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

        values: list[ExceptionGroupingComponentChildren] = []

        if ns_error_component is not None:
            values = [type_component, value_component, ns_error_component, stacktrace_component]
        else:
            values = [type_component, value_component, stacktrace_component]

        # TODO: Once we're fully transitioned off of the `newstyle:2023-01-11` config, the code here
        # (and the option controlling it) can be deleted
        if context.get("use_legacy_exception_subcomponent_order"):
            if ns_error_component is not None:
                values = [stacktrace_component, type_component, ns_error_component, value_component]
            else:
                values = [stacktrace_component, type_component, value_component]

        exception_components_by_variant[variant_name] = ExceptionGroupingComponent(
            values=values, frame_counts=stacktrace_component.frame_counts
        )

    return exception_components_by_variant


@strategy(ids=["chained-exception:v1"], interface=ChainedException, score=2000)
def chained_exception(
    interface: ChainedException, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    # Get all the exceptions to consider.
    all_exceptions = interface.exceptions()

    # For each exception, create a dictionary of grouping components by variant name
    exception_components_by_exception = {
        id(exception): context.get_grouping_components_by_variant(exception, event=event, **kwargs)
        for exception in all_exceptions
    }

    # Filter the exceptions according to rules for handling exception groups.
    try:
        exceptions = filter_exceptions_for_exception_groups(
            all_exceptions, exception_components_by_exception, event
        )
    except Exception:
        # We shouldn't have exceptions here. But if we do, just record it and continue with the
        # original list.
        logging.exception(
            "Failed to filter exceptions for exception groups. Continuing with original list.",
            extra={
                "event_id": context.event.event_id,
                "project_id": context.event.project.id,
                "org_id": context.event.project.organization.id,
            },
        )
        exceptions = all_exceptions

    # Cases 1 and 2: Either this never was a chained exception (this is our entry point for single
    # exceptions, too), or this is a chained exception consisting solely of an exception group and a
    # single inner exception. In the former case, all we have is the single exception component, so
    # return it. In the latter case, the there's no value-add to the wrapper, so discard it and just
    # return the component for the inner exception.
    if len(exceptions) == 1:
        return exception_components_by_exception[id(exceptions[0])]

    # Case 3: This is either a chained exception or an exception group containing at least two inner
    # exceptions. Either way, we need to wrap our exception components in a chained exception component.
    exception_components_by_variant: dict[str, list[ExceptionGroupingComponent]] = {}

    # Handle cases in which we want to switch the `main_exception_id` in order to use a different
    # exception than normal for the event title
    _maybe_override_main_exception_id(event, exceptions)

    for exception in exceptions:
        for variant_name, component in exception_components_by_exception[id(exception)].items():
            exception_components_by_variant.setdefault(variant_name, []).append(component)

    chained_exception_components_by_variant = {}

    for variant_name, variant_exception_components in exception_components_by_variant.items():
        # Calculate an aggregate tally of the different types of frames (in-app vs system,
        # contributing or not) across all of the exceptions in the chain
        total_frame_counts: Counter[str] = Counter()
        for exception_component in variant_exception_components:
            total_frame_counts += exception_component.frame_counts

        chained_exception_component = ChainedExceptionGroupingComponent(
            values=variant_exception_components,
            frame_counts=total_frame_counts,
        )

        # This context value is set by the grouping info endpoint, so that the exception order of
        # the chained exceptions we show in the in the issue details page's grouping info section
        # matches the exception order of the main stacktraces on the page.
        if context.get("reverse_stacktraces"):
            chained_exception_component.reverse_when_serializing = True

        chained_exception_components_by_variant[variant_name] = chained_exception_component

    return chained_exception_components_by_variant


# See https://github.com/getsentry/rfcs/blob/main/text/0079-exception-groups.md#sentry-issue-grouping
def filter_exceptions_for_exception_groups(
    exceptions: list[SingleException],
    exception_components: dict[int, dict[str, ExceptionGroupingComponent]],
    event: Event,
) -> list[SingleException]:
    # This function only filters exceptions if there are at least two exceptions.
    if len(exceptions) <= 1:
        return exceptions

    # TODO: Get rid of this hack!
    #
    # A change in the python SDK between version 2 and version 3 means that suddenly this function
    # applies where it didn't used to, which in turn changes how some exception groups are hashed.
    # As a temporary stopgap, until we can build a system akin to the grouping config transition
    # system to compensate for the change, we're just emulating the old behavior.
    if event.platform == "python" and get_path(event.data, "sdk", "version", default="").startswith(
        "3"
    ):
        return exceptions

    # Reconstruct the tree of exceptions if the required data is present.
    class ExceptionTreeNode:
        def __init__(
            self,
            exception: SingleException | None = None,
            children: list[SingleException] | None = None,
        ):
            self.exception = exception
            self.children = children or []

    exception_tree: dict[int, ExceptionTreeNode] = {}
    ids_seen = set()
    for exception in reversed(exceptions):
        mechanism: Mechanism = exception.mechanism
        if (
            mechanism
            and mechanism.exception_id is not None
            and mechanism.exception_id != mechanism.parent_id
            and mechanism.exception_id not in ids_seen
        ):
            ids_seen.add(mechanism.exception_id)

            node = exception_tree.setdefault(mechanism.exception_id, ExceptionTreeNode())
            node.exception = exception
            exception.exception = exception

            if mechanism.parent_id is not None:
                parent_node = exception_tree.setdefault(mechanism.parent_id, ExceptionTreeNode())
                parent_node.children.append(exception)
        else:
            # At least one exception's mechanism is either missing an exception id, duplicating an
            # exception id we've already seen, or listing the exception as its own parent. Since the
            # tree structure is broken, we can't continue with the filter.
            return exceptions

    # This gets the child exceptions for an exception using the exception_id from the mechanism.
    # That data is guaranteed to exist at this point.
    def get_child_exceptions(exception: SingleException) -> list[SingleException]:
        exception_id = exception.mechanism.exception_id
        node = exception_tree.get(exception_id)
        return node.children if node else []

    # This recursive generator gets the "top-level exceptions," and is used below. Top-level
    # exceptions are those that are the direct descendants of an exception group that are not
    # themselves exception groups. For examples, see
    # https://github.com/getsentry/rfcs/blob/main/text/0079-exception-groups.md#sentry-issue-grouping
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

    # This recursive generator gets the "first-path" of exceptions, and is used below. The first
    # path follows from the root to a leaf node, but only following the first child of each node.
    def get_first_path(exception: SingleException) -> Generator[SingleException]:
        yield exception
        children = get_child_exceptions(exception)
        if children:
            yield from get_first_path(children[0])

    # Traverse the tree recursively from the root exception to get all "top-level exceptions" (see
    # `get_top_level_exceptions` above) and sort by exception type for consistency.
    top_level_exceptions = []
    root_node = exception_tree.get(0)
    if root_node and root_node.exception:
        top_level_exceptions = sorted(
            get_top_level_exceptions(root_node.exception),
            key=lambda exception: str(exception.type),
            reverse=True,
        )
    else:
        # If there's no root exception, return the original list
        return exceptions

    # It's possible to end up with no top-level exceptions, for example if all exceptions in the
    # chain are marked as exception groups and therefore all get excluded, or if the exception tree
    # contains a cycle. (Ideally SDKs should never mark the data this way, but we've run into this
    # before.) In that case, return the list as is.
    if not top_level_exceptions:
        return exceptions

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
    # We'll also set `main_exception_id`, which is used in the `extract_metadata` function
    # in `src/sentry/eventtypes/error.py`, in order to ensure the issue is titled by this
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
    variants: ComponentsByVariant, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    return remove_non_stacktrace_variants(variants)


@strategy(ids=["threads:v1"], interface=Threads, score=1900)
def threads(
    interface: Threads, event: Event, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
    crashed_threads = [thread for thread in interface.values if thread.get("crashed")]
    thread_components = _get_thread_components(crashed_threads, event, context, **kwargs)
    if thread_components is not None:
        return thread_components

    current_threads = [thread for thread in interface.values if thread.get("current")]
    thread_components = _get_thread_components(current_threads, event, context, **kwargs)
    if thread_components is not None:
        return thread_components

    thread_components = _get_thread_components(interface.values, event, context, **kwargs)
    if thread_components is not None:
        return thread_components

    return {
        "app": ThreadsGroupingComponent(
            contributes=False,
            hint=(
                "ignored because it contains neither a single thread nor multiple threads with "
                "exactly one crashing or current thread; instead contains %s crashing, %s current, "
                "and %s total threads"
                % (len(crashed_threads), len(current_threads), len(interface.values))
            ),
        )
    }


def _get_thread_components(
    threads: list[dict[str, Any]], event: Event, context: GroupingContext, **kwargs: dict[str, Any]
) -> ComponentsByVariant | None:
    if len(threads) != 1:
        return None

    stacktrace = threads[0].get("stacktrace")
    if not stacktrace:
        return {
            "app": ThreadsGroupingComponent(
                contributes=False, hint="ignored because thread has no stacktrace"
            )
        }

    thread_components_by_variant = {}

    for variant_name, stacktrace_component in context.get_grouping_components_by_variant(
        stacktrace, event=event, **kwargs
    ).items():
        thread_components_by_variant[variant_name] = ThreadsGroupingComponent(
            values=[stacktrace_component], frame_counts=stacktrace_component.frame_counts
        )

    return thread_components_by_variant


@threads.variant_processor
def threads_variant_processor(
    variants: ComponentsByVariant, context: GroupingContext, **kwargs: Any
) -> ComponentsByVariant:
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
        and exceptions[-1].mechanism
        and exceptions[-1].mechanism.source == "cause"
    ):
        main_exception_id = exceptions[-1].mechanism.exception_id
    return main_exception_id


JAVA_RXJAVA_FRAMEWORK_EXCEPTION_TYPES = [
    "OnErrorNotImplementedException",
    "CompositeException",
    "UndeliverableException",
]


def java_rxjava_framework_exceptions(exceptions: list[SingleException]) -> int | None:
    if len(exceptions) < 2:
        return None

    # find the wrapped RxJava exception
    rxjava_exception_id = None
    for exception in exceptions:
        if (
            exception.module == "io.reactivex.rxjava3.exceptions"
            and exception.type in JAVA_RXJAVA_FRAMEWORK_EXCEPTION_TYPES
            and exception.mechanism
            and exception.mechanism.type == "UncaughtExceptionHandler"
        ):
            rxjava_exception_id = exception.mechanism.exception_id
            break

    # return the inner exception, if any
    if rxjava_exception_id is not None:
        for exception in exceptions:
            if (
                exception.mechanism
                and exception.mechanism.parent_id == rxjava_exception_id
                and exception.mechanism.exception_id is not None
            ):
                return exception.mechanism.exception_id

    return None


MAIN_EXCEPTION_ID_FUNCS = [
    react_error_with_cause,
    java_rxjava_framework_exceptions,
]


def _maybe_override_main_exception_id(event: Event, exceptions: list[SingleException]) -> None:
    main_exception_id = None
    for func in MAIN_EXCEPTION_ID_FUNCS:
        main_exception_id = func(exceptions)
        if main_exception_id is not None:
            break

    if main_exception_id:
        event.data["main_exception_id"] = main_exception_id
