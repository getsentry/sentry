# coding: utf-8
from __future__ import absolute_import


import re

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy
from sentry.grouping.strategies.utils import remove_non_stacktrace_variants, has_url_origin
from sentry.grouping.strategies.message import trim_message_for_grouping
from sentry.grouping.strategies.similarity_encoders import (
    text_shingle_encoder,
    ident_encoder,
)
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.iterators import shingle


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


def is_recursion_v1(frame1, frame2):
    "Returns a boolean indicating whether frames are recursive calls."
    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


def get_filename_component(abs_path, filename, platform, allow_file_origin=False):
    """Attempt to normalize filenames by detecting special filenames and by
    using the basename only.
    """
    if filename is None:
        return GroupingComponent(id="filename")

    # Only use the platform independent basename for grouping and
    # lowercase it
    filename = _basename_re.split(filename)[-1].lower()
    filename_component = GroupingComponent(
        id="filename", values=[filename], similarity_encoder=ident_encoder
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

    return filename_component


def get_module_component(abs_path, module, platform):
    """Given an absolute path, module and platform returns the module component
    with some necessary cleaning performed.
    """
    if module is None:
        return GroupingComponent(id="module")

    module_component = GroupingComponent(
        id="module", values=[module], similarity_encoder=ident_encoder
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
            if module != old_module:
                module_component.update(values=[module], hint="removed codegen marker")

    return module_component


def get_function_component(
    function,
    platform,
    legacy_function_logic,
    prefer_raw_function_name=False,
    sourcemap_used=False,
    context_line_available=False,
    raw_function=None,
    javascript_fuzzing=False,
    php_detect_anonymous_classes=False,
):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.

    The `legacy_function_logic` parameter controls if the system should
    use the frame v1 function name logic or the frame v2 logic.  The difference
    is that v2 uses the function name consistently and v1 prefers raw function
    or a trimmed version (of the truncated one) for native.  Related to this is
    the `prefer_raw_function_name` parameter which just flat out prefers the
    raw function name over the non raw one.
    """
    from sentry.stacktraces.functions import trim_function_name

    behavior_family = get_behavior_family_for_platform(platform)

    if legacy_function_logic or prefer_raw_function_name:
        func = raw_function or function
    else:
        func = function or raw_function
        if not raw_function and function:
            func = trim_function_name(func, platform)

    if not func:
        return GroupingComponent(id="function")

    function_component = GroupingComponent(
        id="function", values=[func], similarity_encoder=ident_encoder
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
        if php_detect_anonymous_classes and func.startswith("class@anonymous"):
            new_function = func.rsplit("::", 1)[-1]
            if new_function != func:
                function_component.update(values=[new_function], hint="anonymous class method")

    elif platform == "java":
        if func.startswith("lambda$"):
            function_component.update(contributes=False, hint="ignored lambda function")

    elif behavior_family == "native":
        if func in ("<redacted>", "<unknown>"):
            function_component.update(contributes=False, hint="ignored unknown function")
        elif legacy_function_logic:
            new_function = trim_function_name(func, platform, normalize_lambdas=False)
            if new_function != func:
                function_component.update(values=[new_function], hint="isolated function")

    elif javascript_fuzzing and behavior_family == "javascript":
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
                contributes_to_similarity=True,
                hint="ignored because sourcemap used and context line available",
            )

    return function_component


@strategy(
    ids=["frame:v1", "frame:v2", "frame:v3", "frame:v4"],
    interfaces=["frame"],
    variants=["!system", "app"],
)
def frame(frame, event, **meta):
    id = meta["strategy"].id
    platform = frame.platform or event.platform

    use_contextline = False
    javascript_fuzzing = False
    php_detect_anonymous_classes = False

    # Version specific bugs
    legacy_function_logic = id == "frame:v1"
    with_context_line_file_origin_bug = id == "frame:v3"

    # We started trimming function names in csharp late which changed the
    # inputs to the grouping code.  Where previously the `function` attribute
    # contained the raw and untrimmed strings, it now contains the trimmed one
    # which is preferred by the frame component.  Because of this we tell the
    # component to prefer the raw function name over the function name for
    # csharp.
    # TODO: if a frame:v5 is added the raw function name should not be preferred
    # for csharp.
    prefer_raw_function_name = platform == "csharp"

    if id in ("frame:v3", "frame:v4"):
        javascript_fuzzing = True
        # These are platforms that we know have always source available and
        # where the source is of good quality for grouping.  For javascript
        # this assumes that we have sourcemaps available.
        use_contextline = platform in ("javascript", "node", "python", "php", "ruby")

    # Starting with v4 we're adding support for anonymous classes
    # detection
    if id == "frame:v4":
        php_detect_anonymous_classes = True

    return get_frame_component(
        frame,
        event,
        meta,
        legacy_function_logic=legacy_function_logic,
        use_contextline=use_contextline,
        javascript_fuzzing=javascript_fuzzing,
        with_context_line_file_origin_bug=with_context_line_file_origin_bug,
        php_detect_anonymous_classes=php_detect_anonymous_classes,
        prefer_raw_function_name=prefer_raw_function_name,
    )


def get_contextline_component(frame, platform, function, with_context_line_file_origin_bug=False):
    """Returns a contextline component.  The caller's responsibility is to
    make sure context lines are only used for platforms where we trust the
    quality of the sourcecode.  It does however protect against some bad
    JavaScript environments based on origin checks.
    """
    line = " ".join((frame.context_line or "").expandtabs(2).split())
    if not line:
        return GroupingComponent(id="context-line")

    component = GroupingComponent(
        id="context-line", values=[line], similarity_encoder=ident_encoder
    )
    if line:
        if len(frame.context_line) > 120:
            component.update(hint="discarded because line too long", contributes=False)
        elif get_behavior_family_for_platform(platform) == "javascript":
            if with_context_line_file_origin_bug:
                if has_url_origin(frame.abs_path, allow_file_origin=True):
                    component.update(hint="discarded because from URL origin", contributes=False)
            elif not function and has_url_origin(frame.abs_path):
                component.update(
                    hint="discarded because from URL origin and no function", contributes=False
                )

    return component


def get_frame_component(
    frame,
    event,
    meta,
    legacy_function_logic=False,
    use_contextline=False,
    javascript_fuzzing=False,
    with_context_line_file_origin_bug=False,
    php_detect_anonymous_classes=False,
    prefer_raw_function_name=False,
):
    platform = frame.platform or event.platform

    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    filename_component = get_filename_component(
        frame.abs_path, frame.filename, platform, allow_file_origin=javascript_fuzzing
    )

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename if it contributes
    module_component = get_module_component(frame.abs_path, frame.module, platform)
    if module_component.contributes and filename_component.contributes:
        filename_component.update(
            contributes=False, contributes_to_similarity=True, hint="module takes precedence"
        )

    context_line_component = None

    # If we are allowed to use the contextline we add it now.
    if use_contextline:
        context_line_component = get_contextline_component(
            frame,
            platform,
            function=frame.function,
            with_context_line_file_origin_bug=with_context_line_file_origin_bug,
        )

    function_component = get_function_component(
        function=frame.function,
        raw_function=frame.raw_function,
        platform=platform,
        sourcemap_used=frame.data and frame.data.get("sourcemap") is not None,
        context_line_available=context_line_component and context_line_component.contributes,
        legacy_function_logic=legacy_function_logic,
        prefer_raw_function_name=prefer_raw_function_name,
        javascript_fuzzing=javascript_fuzzing,
        php_detect_anonymous_classes=php_detect_anonymous_classes,
    )

    values = [module_component, filename_component, function_component]
    if context_line_component is not None:
        values.append(context_line_component)

    rv = GroupingComponent(id="frame", values=values)

    # if we are in javascript fuzzing mode we want to disregard some
    # frames consistently.  These force common bad stacktraces together
    # to have a common hash at the cost of maybe skipping over frames that
    # would otherwise be useful.
    if javascript_fuzzing and get_behavior_family_for_platform(platform) == "javascript":
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

    return rv


@strategy(id="stacktrace:v1", interfaces=["stacktrace"], variants=["!system", "app"], score=1800)
def stacktrace(stacktrace, config, variant, **meta):
    return get_stacktrace_component(stacktrace, config, variant, meta)


@stacktrace.variant_processor
def stacktrace_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)


def get_stacktrace_component(stacktrace, config, variant, meta):
    frames = stacktrace.frames
    all_frames_considered_in_app = False

    values = []
    prev_frame = None
    frames_for_filtering = []
    for frame in frames:
        frame_component = config.get_grouping_component(frame, variant=variant, **meta)
        if variant == "app" and not frame.in_app and not all_frames_considered_in_app:
            frame_component.update(contributes=False, hint="non app frame")
        elif prev_frame is not None and is_recursion_v1(frame, prev_frame):
            frame_component.update(contributes=False, hint="ignored due to recursion")
        elif variant == "app" and not frame.in_app and all_frames_considered_in_app:
            frame_component.update(hint="frame considered in-app because no frame is in-app")
        values.append(frame_component)
        frames_for_filtering.append(frame.get_raw_data())
        prev_frame = frame

    # Special case for JavaScript where we want to ignore single frame
    # stacktraces in certain cases where those would be of too low quality
    # for grouping.
    if (
        len(frames) == 1
        and values[0].contributes
        and get_behavior_family_for_platform(frames[0].platform or meta["event"].platform)
        == "javascript"
        and not frames[0].function
        and frames[0].is_url()
    ):
        values[0].update(contributes=False, hint="ignored single non-URL JavaScript frame")

    return config.enhancements.assemble_stacktrace_component(
        values,
        frames_for_filtering,
        meta["event"].platform,
        similarity_self_encoder=_stacktrace_encoder,
    )


def _stacktrace_encoder(id, stacktrace):
    encoded_frames = []

    for frame in stacktrace.values:
        encoded = {}
        for (component_id, shingle_label), features in frame.encode_for_similarity():
            assert (
                shingle_label == "ident-shingle"
            ), "Frames cannot use anything other than ident shingles for now"

            if not features:
                continue

            assert (
                len(features) == 1 and component_id not in encoded
            ), "Frames cannot use anything other than ident shingles for now"
            encoded[component_id] = features[0]

        if encoded:
            # add frozen dict
            encoded_frames.append(tuple(sorted(encoded.items())))

    if len(encoded_frames) < 2:
        if encoded_frames:
            yield (id, "frames-ident"), encoded_frames
        return

    yield (id, "frames-pairs"), shingle(2, encoded_frames)


def single_exception_common(exception, config, meta, with_value):
    if exception.stacktrace is not None:
        stacktrace_component = config.get_grouping_component(exception.stacktrace, **meta)
    else:
        stacktrace_component = GroupingComponent(id="stacktrace")

    type_component = GroupingComponent(
        id="type",
        values=[exception.type] if exception.type else [],
        similarity_encoder=ident_encoder,
    )

    if exception.mechanism and exception.mechanism.synthetic:
        type_component.update(contributes=False, hint="ignored because exception is synthetic")

    values = [stacktrace_component, type_component]

    if with_value:
        value_component = GroupingComponent(id="value", similarity_encoder=text_shingle_encoder(5))

        value_in = exception.value
        if value_in is not None:
            value_trimmed = trim_message_for_grouping(value_in)
            hint = "stripped common values" if value_in != value_trimmed else None
            if value_trimmed:
                value_component.update(values=[value_trimmed], hint=hint)

        if stacktrace_component.contributes and value_component.contributes:
            value_component.update(
                contributes=False,
                contributes_to_similarity=True,
                hint="ignored because stacktrace takes precedence",
            )

        values.append(value_component)

    return GroupingComponent(id="exception", values=values)


@strategy(
    ids=["single-exception:v1", "single-exception:v2"],
    interfaces=["singleexception"],
    variants=["!system", "app"],
)
def single_exception(exception, config, **meta):
    id = meta["strategy"].id
    with_value = id == "single-exception:v2"
    return single_exception_common(exception, config, meta, with_value=with_value)


@strategy(
    id="chained-exception:v1", interfaces=["exception"], variants=["!system", "app"], score=2000
)
def chained_exception(chained_exception, config, **meta):
    # Case 1: we have a single exception, use the single exception
    # component directly to avoid a level of nesting
    exceptions = chained_exception.exceptions()
    if len(exceptions) == 1:
        return config.get_grouping_component(exceptions[0], **meta)

    # Case 2: produce a component for each chained exception
    values = [config.get_grouping_component(exception, **meta) for exception in exceptions]
    return GroupingComponent(id="chained-exception", values=values)


@chained_exception.variant_processor
def chained_exception_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)


@strategy(id="threads:v1", interfaces=["threads"], variants=["!system", "app"], score=1900)
def threads(threads_interface, config, **meta):
    thread_count = len(threads_interface.values)
    if thread_count != 1:
        return GroupingComponent(
            id="threads",
            contributes=False,
            hint="ignored because contains %d threads" % thread_count,
        )

    stacktrace = threads_interface.values[0].get("stacktrace")
    if not stacktrace:
        return GroupingComponent(id="threads", contributes=False, hint="thread has no stacktrace")

    return GroupingComponent(
        id="threads", values=[config.get_grouping_component(stacktrace, **meta)]
    )


@threads.variant_processor
def threads_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)
