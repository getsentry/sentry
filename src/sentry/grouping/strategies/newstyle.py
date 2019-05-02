# coding: utf-8
from __future__ import absolute_import

import re

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy
from sentry.grouping.strategies.utils import remove_non_stacktrace_variants
from sentry.grouping.strategies.message import trim_message_for_grouping
from sentry.stacktraces.platform import get_behavior_family_for_platform


_ruby_erb_func = re.compile(r'__\d{4,}_\d{4,}$')
_basename_re = re.compile(r'[/\\]')

# OpenJDK auto-generated classes for reflection access:
#   sun.reflect.GeneratedSerializationConstructorAccessor123
#   sun.reflect.GeneratedConstructorAccessor456
# Note that this doesn't cover the following pattern for the sake of
# backward compatibility (to not to change the existing grouping):
#   sun.reflect.GeneratedMethodAccessor789
_java_reflect_enhancer_re = re.compile(
    r'''(sun\.reflect\.Generated(?:Serialization)?ConstructorAccessor)\d+''',
    re.X
)

# Java Spring specific anonymous classes.
# see: http://mydailyjava.blogspot.co.at/2013/11/cglib-missing-manual.html
_java_cglib_enhancer_re = re.compile(r'''(\$\$[\w_]+?CGLIB\$\$)[a-fA-F0-9]+(_[0-9]+)?''', re.X)

# Handle Javassist auto-generated classes and filenames:
#   com.example.api.entry.EntriesResource_$$_javassist_74
#   com.example.api.entry.EntriesResource_$$_javassist_seam_74
#   EntriesResource_$$_javassist_seam_74.java
_java_assist_enhancer_re = re.compile(r'''(\$\$_javassist)(?:_seam)?(?:_[0-9]+)?''', re.X)

# Clojure anon functions are compiled down to myapp.mymodule$fn__12345
_clojure_enhancer_re = re.compile(r'''(\$fn__)\d+''', re.X)

# fields that need to be the same between frames for them to be considered
# recursive calls
RECURSION_COMPARISON_FIELDS = [
    'abs_path',
    'package',
    'module',
    'filename',
    'function',
    'lineno',
    'colno',
]


def abs_path_is_url_v1(abs_path):
    if not abs_path:
        return False
    return abs_path.startswith((
        'blob:', 'file:', 'http:', 'https:', 'applewebdata:'))


def is_recursion_v1(frame1, frame2):
    "Returns a boolean indicating whether frames are recursive calls."
    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


def get_filename_component_v1(abs_path, filename, platform):
    """Attempt to normalize filenames by detecing special filenames and by
    using the basename only.
    """
    if filename is None:
        return GroupingComponent(id='filename')

    # Only use the platform independent basename for grouping and
    # lowercase it
    filename = _basename_re.split(filename)[-1].lower()
    filename_component = GroupingComponent(
        id='filename',
        values=[filename],
    )

    if abs_path_is_url_v1(abs_path):
        filename_component.update(
            contributes=False,
            hint='ignored because frame points to a URL',
        )
    elif filename == '<anonymous>':
        filename_component.update(
            contributes=False,
            hint='anonymous filename discarded'
        )
    elif filename == '[native code]':
        filename_component.update(
            contributes=False,
            hint='native code indicated by filename'
        )
    elif platform == 'java':
        new_filename = _java_assist_enhancer_re.sub(r'\1<auto>', filename)
        if new_filename != filename:
            filename_component.update(
                values=[new_filename],
                hint='cleaned javassist parts'
            )

    return filename_component


def get_module_component_v1(abs_path, module, platform):
    """Given an absolute path, module and platform returns the module component
    with some necessary cleaning performed.
    """
    if module is None:
        return GroupingComponent(id='module')

    module_component = GroupingComponent(
        id='module',
        values=[module]
    )

    if platform == 'javascript' and '/' in module and abs_path and abs_path.endswith(module):
        module_component.update(
            contributes=False,
            hint='ignored bad javascript module',
        )
    elif platform == 'java':
        if '$$Lambda$' in module:
            module_component.update(
                contributes=False,
                hint='ignored java lambda',
            )
        if module[:35] == 'sun.reflect.GeneratedMethodAccessor':
            module_component.update(
                values=['sun.reflect.GeneratedMethodAccessor'],
                hint='removed reflection marker',
            )
        else:
            old_module = module
            module = _java_reflect_enhancer_re.sub(r'\1<auto>', module)
            module = _java_cglib_enhancer_re.sub(r'\1<auto>', module)
            module = _java_assist_enhancer_re.sub(r'\1<auto>', module)
            module = _clojure_enhancer_re.sub(r'\1<auto>', module)
            if module != old_module:
                module_component.update(
                    values=[module],
                    hint='removed codegen marker'
                )

    return module_component


def get_function_component(function, platform, legacy_function_logic,
                           raw_function=None):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.

    The `legacy_function_logic` parameter controls if the system should
    use the frame v1 function name logic or the frame v2 logic.  The difference
    is that v2 uses the function name consistently and v1 prefers raw function
    or a trimmed version (of the truncated one) for native.
    """
    from sentry.stacktraces.functions import trim_function_name

    if legacy_function_logic:
        func = raw_function or function
    else:
        func = function or raw_function
        if not raw_function and function:
            func = trim_function_name(func, platform)

    if not func:
        return GroupingComponent(id='function')

    function_component = GroupingComponent(
        id='function',
        values=[func],
    )

    if platform == 'ruby':
        if func.startswith('block '):
            function_component.update(
                values=['block'],
                hint='ruby block'
            )
        else:
            new_function = _ruby_erb_func.sub('', func)
            if new_function != func:
                function_component.update(
                    values=[new_function],
                    hint='removed generated erb template suffix'
                )

    elif platform == 'php':
        if func.startswith('[Anonymous'):
            function_component.update(
                contributes=False,
                hint='ignored anonymous function'
            )

    elif platform == 'java':
        if func.startswith('lambda$'):
            function_component.update(
                contributes=False,
                hint='ignored lambda function'
            )

    elif get_behavior_family_for_platform(platform) == 'native':
        if func in ('<redacted>', '<unknown>'):
            function_component.update(
                contributes=False,
                hint='ignored unknown function'
            )
        elif legacy_function_logic:
            new_function = trim_function_name(func, platform)
            if new_function != func:
                function_component.update(
                    values=[new_function],
                    hint='isolated function'
                )

    return function_component


@strategy(
    id='frame:v1',
    interfaces=['frame'],
    variants=['!system', 'app'],
)
def frame_v1(frame, event, **meta):
    return get_frame_component(frame, event, meta,
                               legacy_function_logic=True)


@strategy(
    id='frame:v2',
    interfaces=['frame'],
    variants=['!system', 'app'],
)
def frame_v2(frame, event, **meta):
    return get_frame_component(frame, event, meta,
                               legacy_function_logic=False)


def get_frame_component(frame, event, meta, legacy_function_logic=False):
    platform = frame.platform or event.platform

    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    filename_component = get_filename_component_v1(
        frame.abs_path, frame.filename, platform)

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename if it contributes
    module_component = get_module_component_v1(
        frame.abs_path, frame.module, platform)
    if module_component.contributes and filename_component.contributes:
        filename_component.update(
            contributes=False,
            hint='module takes precedence'
        )

    function_component = get_function_component(
        function=frame.function,
        raw_function=frame.raw_function,
        platform=platform,
        legacy_function_logic=legacy_function_logic
    )

    return GroupingComponent(
        id='frame',
        values=[
            module_component,
            filename_component,
            function_component,
        ],
    )


@strategy(
    id='stacktrace:v1',
    interfaces=['stacktrace'],
    variants=['!system', 'app'],
    score=1800,
)
def stacktrace_v1(stacktrace, config, variant, **meta):
    frames = stacktrace.frames
    hint = None
    all_frames_considered_in_app = False

    values = []
    prev_frame = None
    frames_for_filtering = []
    for frame in frames:
        frame_component = config.get_grouping_component(frame, variant=variant, **meta)
        if variant == 'app' and not frame.in_app and not all_frames_considered_in_app:
            frame_component.update(
                contributes=False,
                hint='non app frame',
            )
        elif prev_frame is not None and is_recursion_v1(frame, prev_frame):
            frame_component.update(
                contributes=False,
                hint='ignored due to recursion',
            )
        elif variant == 'app' and not frame.in_app and all_frames_considered_in_app:
            frame_component.update(
                hint='frame considered in-app because no frame is in-app'
            )
        values.append(frame_component)
        frames_for_filtering.append(frame.get_raw_data())
        prev_frame = frame

    config.enhancements.update_frame_components_contributions(
        values, frames_for_filtering, meta['event'].platform)

    return GroupingComponent(
        id='stacktrace',
        values=values,
        hint=hint,
    )


@stacktrace_v1.variant_processor
def stacktrace_v1_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)


def single_exception_common(exception, config, meta, with_value):
    if exception.stacktrace is not None:
        stacktrace_component = config.get_grouping_component(
            exception.stacktrace, **meta)
    else:
        stacktrace_component = GroupingComponent(id='stacktrace')

    type_component = GroupingComponent(
        id='type',
        values=[exception.type] if exception.type else [],
    )

    if exception.mechanism and exception.mechanism.synthetic:
        type_component.update(
            contributes=False,
            hint='ignored because exception is synthetic'
        )

    values = [stacktrace_component, type_component]

    if with_value:
        value_component = GroupingComponent(id='value')

        value_in = exception.value
        if value_in is not None:
            value_trimmed = trim_message_for_grouping(value_in)
            hint = 'stripped common values' if value_in != value_trimmed else None
            if value_trimmed:
                value_component.update(
                    values=[value_trimmed],
                    hint=hint
                )

        if stacktrace_component.contributes and value_component.contributes:
            value_component.update(
                contributes=False,
                hint='ignored because stacktrace takes precedence'
            )

        values.append(value_component)

    return GroupingComponent(
        id='exception',
        values=values
    )


@strategy(
    id='single-exception:v1',
    interfaces=['singleexception'],
    variants=['!system', 'app'],
)
def single_exception_v1(exception, config, **meta):
    return single_exception_common(exception, config, meta, with_value=False)


@strategy(
    id='single-exception:v2',
    interfaces=['singleexception'],
    variants=['!system', 'app'],
)
def single_exception_v2(exception, config, **meta):
    return single_exception_common(exception, config, meta, with_value=True)


@strategy(
    id='chained-exception:v1',
    interfaces=['exception'],
    variants=['!system', 'app'],
    score=2000,
)
def chained_exception_v1(chained_exception, config, **meta):
    # Case 1: we have a single exception, use the single exception
    # component directly to avoid a level of nesting
    exceptions = chained_exception.exceptions()
    if len(exceptions) == 1:
        return config.get_grouping_component(exceptions[0], **meta)

    # Case 2: produce a component for each chained exception
    values = [config.get_grouping_component(exception, **meta)
              for exception in exceptions]
    return GroupingComponent(
        id='chained-exception',
        values=values,
    )


@chained_exception_v1.variant_processor
def chained_exception_v1_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)


@strategy(
    id='threads:v1',
    interfaces=['threads'],
    variants=['!system', 'app'],
    score=1900,
)
def threads_v1(threads_interface, config, **meta):
    thread_count = len(threads_interface.values)
    if thread_count != 1:
        return GroupingComponent(
            id='threads',
            contributes=False,
            hint='ignored because contains %d threads' % thread_count,
        )

    stacktrace = threads_interface.values[0].get('stacktrace')
    if not stacktrace:
        return GroupingComponent(
            id='threads',
            contributes=False,
            hint='thread has no stacktrace',
        )

    return GroupingComponent(
        id='threads',
        values=[config.get_grouping_component(stacktrace, **meta)],
    )


@threads_v1.variant_processor
def threads_v1_variant_processor(variants, config, **meta):
    return remove_non_stacktrace_variants(variants)
