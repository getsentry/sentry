# coding: utf-8
from __future__ import absolute_import

import re

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy
from sentry.grouping.strategies.utils import replace_enclosed_string, split_func_tokens


_ruby_anon_func = re.compile(r'_\d{2,}')
_basename_re = re.compile(r'[/\\]')
_cpp_trailer_re = re.compile(r'(\bconst\b|&)$')

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

# Native function trim re.  For now this is a simple hack until we have the
# language hints in which will let us trim this down better.
_native_function_trim_re = re.compile(r'^(.[^(]*)\(')

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


def isolate_native_function_v1(function):
    original_function = function
    function = function.strip()

    # Ensure we don't operated on objc functions
    if function.startswith(('[', '+[', '-[')):
        return function

    # Chop off C++ trailers
    while 1:
        match = _cpp_trailer_re.search(function)
        if match is None:
            break
        function = function[:match.start()].rstrip()

    # Because operator<< really screws with our balancing, so let's work
    # around that by replacing it with a character we do not observe in
    # `split_func_tokens` or `replace_enclosed_string`.
    function = function \
        .replace('operator<<', u'operator⟨⟨') \
        .replace('operator<', u'operator⟨') \
        .replace('operator()', u'operator◯')

    # Remove the arguments if there is one.
    def process_args(value, start):
        value = value.strip()
        if value in ('anonymous namespace', 'operator'):
            return '(%s)' % value
        return ''
    function = replace_enclosed_string(function, '(', ')', process_args)

    # Resolve generic types, but special case rust which uses things like
    # <Foo as Bar>::baz to denote traits.
    def process_generics(value, start):
        # Rust special case
        if start == 0:
            return '<%s>' % replace_enclosed_string(value, '<', '>', process_generics)
        return '<T>'
    function = replace_enclosed_string(function, '<', '>', process_generics)

    # The last token is the function name.
    tokens = split_func_tokens(function)
    if tokens:
        return tokens[-1].replace(u'⟨', '<').replace(u'◯', '()')

    # This really should never happen
    return original_function


def get_function_component_v1(function, platform):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.
    """
    if not function:
        return GroupingComponent(id='function')

    function_component = GroupingComponent(
        id='function',
        values=[function],
    )

    if platform == 'ruby':
        if function.startswith('block '):
            function_component.update(
                values=['block'],
                hint='ruby block'
            )
        else:
            new_function = _ruby_anon_func.sub('_<anon>', function)
            if new_function != function:
                function_component.update(
                    values=[new_function],
                    hint='removed integer suffix'
                )

    elif platform == 'php':
        if function.startswith('[Anonymous'):
            function_component.update(
                contributes=False,
                hint='ignored anonymous function'
            )

    elif platform == 'java':
        if function.startswith('lambda$'):
            function_component.update(
                contributes=False,
                hint='ignored lambda function'
            )

    elif platform in ('objc', 'cocoa', 'native'):
        if function in ('<redacted>', '<unknown>'):
            function_component.update(
                contributes=False,
                hint='ignored unknown function'
            )
        else:
            new_function = isolate_native_function_v1(function)
            if new_function != function:
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

    function_component = get_function_component_v1(
        frame.function, platform)

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
        prev_frame = frame

    return GroupingComponent(
        id='stacktrace',
        values=values,
        hint=hint,
    )
