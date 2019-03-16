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


def is_url_v1(filename):
    return filename.startswith(('file:', 'http:', 'https:', 'applewebdata:'))


def is_url_frame_v1(frame):
    if not frame.abs_path:
        return False
    # URLs can be generated such that they are:
    #   blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0
    # https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
    if frame.abs_path.startswith('blob:'):
        return True
    return is_url_v1(frame.abs_path)


def is_unhashable_module_v1(frame, platform):
    # Fix for the case where module is a partial copy of the URL
    # and should not be hashed
    if (platform == 'javascript' and '/' in frame.module
            and frame.abs_path and frame.abs_path.endswith(frame.module)):
        return True
    elif platform == 'java' and '$$Lambda$' in frame.module:
        return True
    return False


def is_unhashable_function_v1(frame):
    # TODO(dcramer): lambda$ is Java specific
    # TODO(dcramer): [Anonymous is PHP specific (used for things like SQL
    # queries and JSON data)
    return frame.function.startswith(('lambda$', '[Anonymous'))


def is_recursion_v1(frame1, frame2):
    "Returns a boolean indicating whether frames are recursive calls."
    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


def remove_module_outliers_v1(module, platform):
    """Remove things that augment the module but really should not."""
    if platform == 'java':
        if module[:35] == 'sun.reflect.GeneratedMethodAccessor':
            return 'sun.reflect.GeneratedMethodAccessor', 'removed reflection marker'
        old_module = module
        module = _java_reflect_enhancer_re.sub(r'\1<auto>', module)
        module = _java_cglib_enhancer_re.sub(r'\1<auto>', module)
        module = _java_assist_enhancer_re.sub(r'\1<auto>', module)
        module = _clojure_enhancer_re.sub(r'\1<auto>', module)
        if old_module != module:
            return module, 'removed codegen marker'
    return module, None


def remove_filename_outliers_v1(filename, platform):
    """
    Attempt to normalize filenames by removing common platform outliers.

    - Sometimes filename paths contain build numbers
    """
    # Only use the platform independent basename for grouping and
    # lowercase it
    filename = _basename_re.split(filename)[-1].lower()

    removed = []
    if platform == 'java':
        new_filename = _java_assist_enhancer_re.sub(r'\1<auto>', filename)
        if new_filename != filename:
            removed.append('javassist parts')
            filename = new_filename

    if removed:
        return filename, 'removed %s' % ' and '.join(removed)
    return filename, None


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
        .replace('operator<', u'operator⟨')

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
        return tokens[-1].replace(u'⟨', '<')

    # This really should never happen
    return original_function


def remove_function_outliers_v1(function, platform):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.
    """
    if platform == 'ruby':
        if function.startswith('block '):
            return 'block', 'ruby block'
        new_function = _ruby_anon_func.sub('_<anon>', function)
        if new_function != function:
            return new_function, 'trimmed integer suffix'

    if platform in ('objc', 'cocoa', 'native'):
        new_function = isolate_native_function_v1(function)
        if new_function != function:
            return new_function, 'isolated function'

    return function, None


@strategy(
    id='frame:v1',
    interfaces=['frame'],
    variants=['!system', 'app'],
)
def frame_v1(frame, event, **meta):
    platform = frame.platform or event.platform

    # In certain situations we want to disregard the entire frame.
    contributes = None
    hint = None

    # Safari throws [native code] frames in for calls like ``forEach``
    # whereas Chrome ignores these. Let's remove it from the hashing algo
    # so that they're more likely to group together
    filename_component = GroupingComponent(id='filename')
    if frame.filename == '<anonymous>':
        filename_component.update(
            contributes=False,
            values=[frame.filename],
            hint='anonymous filename discarded'
        )
    elif frame.filename == '[native code]':
        contributes = False
        hint = 'native code indicated by filename'
    elif frame.filename:
        if is_url_frame_v1(frame):
            filename_component.update(
                contributes=False,
                values=[frame.filename],
                hint='ignored because filename is a URL',
            )
        else:
            hashable_filename, hashable_filename_hint = \
                remove_filename_outliers_v1(frame.filename, platform)
            filename_component.update(
                values=[hashable_filename],
                hint=hashable_filename_hint
            )

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename, even if the module is
    # considered unhashable.
    module_component = GroupingComponent(id='module')
    if frame.module:
        if is_unhashable_module_v1(frame, platform):
            module_component.update(
                values=[GroupingComponent(
                    id='salt',
                    values=['<module>'],
                    hint='normalized generated module name'
                )],
                hint='ignored module',
            )
        else:
            module_name, module_hint = \
                remove_module_outliers_v1(frame.module, platform)
            module_component.update(
                values=[module_name],
                hint=module_hint
            )
        if filename_component.contributes:
            filename_component.update(
                contributes=False,
                hint='module takes precedence'
            )

    function_component = GroupingComponent(id='function')

    if frame.function:
        function, function_hint = remove_function_outliers_v1(
            frame.function, platform)
        if is_unhashable_function_v1(frame):
            function_component.update(
                values=[function],
                contributes=False,
                hint='normalized lambda function name ignored'
            )
        else:
            function_component.update(
                values=[function],
                hint=function_hint
            )

    return GroupingComponent(
        id='frame',
        values=[
            module_component,
            filename_component,
            function_component,
        ],
        contributes=contributes,
        hint=hint,
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
