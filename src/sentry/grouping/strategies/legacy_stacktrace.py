from __future__ import absolute_import

import re
import posixpath

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


_ruby_anon_func = re.compile(r'_\d{2,}')
_filename_version_re = re.compile(
    r"""(?:
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/""", re.X | re.I
)

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


def is_url_legacy(filename):
    return filename.startswith(('file:', 'http:', 'https:', 'applewebdata:'))


def is_url_frame_legacy(frame):
    if not frame.abs_path:
        return False
    # URLs can be generated such that they are:
    #   blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0
    # https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
    if frame.abs_path.startswith('blob:'):
        return True
    return is_url_legacy(frame.abs_path)


def is_unhashable_module_legacy(frame, platform):
    # Fix for the case where module is a partial copy of the URL
    # and should not be hashed
    if (platform == 'javascript' and '/' in frame.module
            and frame.abs_path and frame.abs_path.endswith(frame.module)):
        return True
    elif platform == 'java' and '$$Lambda$' in frame.module:
        return True
    return False


def is_unhashable_function_legacy(frame):
    # TODO(dcramer): lambda$ is Java specific
    # TODO(dcramer): [Anonymous is PHP specific (used for things like SQL
    # queries and JSON data)
    return frame.function.startswith(('lambda$', '[Anonymous'))


def is_recursion_legacy(frame1, frame2):
    "Returns a boolean indicating whether frames are recursive calls."
    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


def remove_module_outliers_legacy(module, platform):
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


def remove_filename_outliers_legacy(filename, platform):
    """
    Attempt to normalize filenames by removing common platform outliers.

    - Sometimes filename paths contain build numbers
    """
    # On cocoa we generally only want to use the last path component as
    # the filename.  The reason for this is that the chances are very high
    # that full filenames contain information we do want to strip but
    # currently can't (for instance because the information we get from
    # the dwarf files does not contain prefix information) and that might
    # contain things like /Users/foo/Dropbox/...
    if platform == 'cocoa':
        return posixpath.basename(filename), 'stripped to basename'

    removed = []
    if platform == 'java':
        new_filename = _java_assist_enhancer_re.sub(r'\1<auto>', filename)
        if new_filename != filename:
            removed.append('javassist parts')
            filename = new_filename

    new_filename = _filename_version_re.sub('<version>/', filename)
    if new_filename != filename:
        removed.append('version')
        filename = new_filename

    if removed:
        return filename, 'removed %s' % ' and '.join(removed)
    return filename, None


def remove_function_outliers_legacy(function):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.
    """
    if function.startswith('block '):
        return 'block', 'ruby block'
    new_function = _ruby_anon_func.sub('_<anon>', function)
    if new_function != function:
        return new_function, 'trimmed integer suffix'
    return new_function, None


@strategy(
    id='frame:legacy',
    interfaces=['frame'],
    variants=['!system', 'app'],
)
def frame_legacy(frame, event, **meta):
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
        if is_url_frame_legacy(frame):
            filename_component.update(
                contributes=False,
                values=[frame.filename],
                hint='ignored because filename is a URL',
            )
        # XXX(dcramer): dont compute hash using frames containing the 'Caused by'
        # text as it contains an exception value which may may contain dynamic
        # values (see raven-java#125)
        elif frame.filename.startswith('Caused by: '):
            filename_component.update(
                values=[frame.filename],
                contributes=False,
                hint='ignored because invalid'
            )
        else:
            hashable_filename, hashable_filename_hint = \
                remove_filename_outliers_legacy(frame.filename, platform)
            filename_component.update(
                values=[hashable_filename],
                hint=hashable_filename_hint
            )

    # if we have a module we use that for grouping.  This will always
    # take precedence over the filename, even if the module is
    # considered unhashable.
    module_component = GroupingComponent(id='module')
    if frame.module:
        if is_unhashable_module_legacy(frame, platform):
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
                remove_module_outliers_legacy(frame.module, platform)
            module_component.update(
                values=[module_name],
                hint=module_hint
            )
        if frame.filename:
            filename_component.update(
                values=[frame.filename],
                contributes=False,
                hint='module takes precedence'
            )

    # Context line when available is the primary contributor
    context_line_component = GroupingComponent(id='context-line')
    if frame.context_line is not None:
        if len(frame.context_line) > 120:
            context_line_component.update(hint='discarded because line too long')
        elif is_url_frame_legacy(frame) and not frame.function:
            context_line_component.update(hint='discarded because from URL origin')
        else:
            context_line_component.update(values=[frame.context_line])

    symbol_component = GroupingComponent(id='symbol')
    function_component = GroupingComponent(id='function')
    lineno_component = GroupingComponent(id='lineno')

    # The context line grouping information is the most reliable one.
    # If we did not manage to find some information there, we want to
    # see if we can come up with some extra information.  We only want
    # to do that if we managed to get a module of filename.
    if not context_line_component.contributes and \
       (module_component.contributes or filename_component.contributes):
        if frame.symbol:
            symbol_component.update(values=[frame.symbol])
            if frame.function:
                function_component.update(
                    contributes=False,
                    values=[frame.function],
                    hint='symbol takes precedence'
                )
            if frame.lineno:
                lineno_component.update(
                    contributes=False,
                    values=[frame.lineno],
                    hint='symbol takes precedence'
                )
        elif frame.function:
            if is_unhashable_function_legacy(frame):
                function_component.update(values=[
                    GroupingComponent(
                        id='salt',
                        values=['<function>'],
                        hint='normalized lambda function name'
                    )
                ])
            else:
                function, function_hint = remove_function_outliers_legacy(frame.function)
                function_component.update(
                    values=[function],
                    hint=function_hint
                )
            if frame.lineno:
                lineno_component.update(
                    contributes=False,
                    values=[frame.lineno],
                    hint='function takes precedence'
                )
        elif frame.lineno:
            lineno_component.update(values=[frame.lineno])
    else:
        if frame.symbol:
            symbol_component.update(
                contributes=False,
                values=[frame.symbol],
                hint='symbol is used only if module or filename are available'
            )
        if frame.function:
            function_component.update(
                contributes=False,
                values=[frame.function],
                hint='function name is used only if module or filename are available'
            )
        if frame.lineno:
            lineno_component.update(
                contributes=False,
                values=[frame.lineno],
                hint='line number is used only if module or filename are available'
            )

    return GroupingComponent(
        id='frame',
        values=[
            module_component,
            filename_component,
            context_line_component,
            symbol_component,
            function_component,
            lineno_component,
        ],
        contributes=contributes,
        hint=hint,
    )


@strategy(
    id='stacktrace:legacy',
    interfaces=['stacktrace'],
    variants=['!system', 'app'],
    score=1800,
)
def stacktrace_legacy(stacktrace, config, variant, **meta):
    frames = stacktrace.frames
    contributes = None
    hint = None
    all_frames_considered_in_app = False

    # TODO(dcramer): this should apply only to platform=javascript
    # Browser JS will often throw errors (from inlined code in an HTML page)
    # which contain only a single frame, no function name, and have the HTML
    # document as the filename. In this case the hash is often not usable as
    # the context cannot be trusted and the URL is dynamic (this also means
    # the line number cannot be trusted).
    if (len(frames) == 1 and not frames[0].function and frames[0].is_url()):
        contributes = False
        hint = 'ignored single frame stack'
    elif variant == 'app':
        total_frames = len(frames)
        in_app_count = sum(1 if f.in_app else 0 for f in frames)
        if in_app_count == 0:
            in_app_count = total_frames
            all_frames_considered_in_app = True

        # if app frames make up less than 10% of the stacktrace discard
        # the hash as invalid
        if total_frames > 0 and in_app_count / float(total_frames) < 0.10:
            contributes = False
            hint = 'less than 10% of frames are in-app'

    values = []
    prev_frame = None
    for frame in frames:
        frame_component = config.get_grouping_component(frame, variant=variant, **meta)
        if variant == 'app' and not frame.in_app and not all_frames_considered_in_app:
            frame_component.update(
                contributes=False,
                hint='non app frame',
            )
        elif prev_frame is not None and is_recursion_legacy(frame, prev_frame):
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
        contributes=contributes,
        hint=hint,
    )
