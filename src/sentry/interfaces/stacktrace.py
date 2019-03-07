"""
sentry.interfaces.stacktrace
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Stacktrace', )

import re
import six
import posixpath
from itertools import islice, chain

from django.conf import settings
from django.utils.translation import ugettext as _
from six.moves.urllib.parse import urlparse

from sentry.app import env
from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.models import UserOption
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string
from sentry.event_hashing import GroupingComponent

_ruby_anon_func = re.compile(r'_\d{2,}')
_filename_version_re = re.compile(
    r"""(?:
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/""", re.X | re.I
)

# Native function trim re.  For now this is a simple hack until we have the
# language hints in which will let us trim this down better.
_native_function_trim_re = re.compile(r'^(.[^(]*)\(')

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


def max_addr(cur, addr):
    if addr is None:
        return cur
    length = len(addr) - 2
    if length > cur:
        return length
    return cur


def pad_hex_addr(addr, length):
    if length is None or addr is None:
        return addr
    return '0x' + addr[2:].rjust(length, '0')


def trim_package(pkg):
    if not pkg:
        return '?'
    pkg = pkg.split('/')[-1]
    if pkg.endswith(('.dylib', '.so', '.a')):
        pkg = pkg.rsplit('.', 1)[0]
    return pkg


def trim_function_name(func, platform):
    # TODO(mitsuhiko): we actually want to use the language information here
    # but we don't have that yet.
    if platform in ('objc', 'cocoa', 'native'):
        # objc function
        if func.startswith(('[', '+[', '-[')):
            return func
        # c/c++ function hopefully
        match = _native_function_trim_re.match(func.strip())
        if match is not None:
            return match.group(1).strip()
    return func


def to_hex_addr(addr):
    if addr is None:
        return None
    elif isinstance(addr, six.integer_types):
        rv = '0x%x' % addr
    elif isinstance(addr, six.string_types):
        if addr[:2] == '0x':
            addr = int(addr[2:], 16)
        rv = '0x%x' % int(addr)
    else:
        raise ValueError('Unsupported address format %r' % (addr, ))
    if len(rv) > 24:
        raise ValueError('Address too long %r' % (rv, ))
    return rv


def get_context(lineno, context_line, pre_context=None, post_context=None, filename=None):
    if lineno is None:
        return []

    if context_line is None and not (pre_context or post_context):
        return []

    lineno = int(lineno)
    context = []
    start_lineno = lineno - len(pre_context or [])
    if pre_context:
        start_lineno = lineno - len(pre_context)
        at_lineno = start_lineno
        for line in pre_context:
            context.append((at_lineno, line))
            at_lineno += 1
    else:
        start_lineno = lineno
        at_lineno = lineno

    if start_lineno < 0:
        start_lineno = 0

    context.append((at_lineno, context_line))
    at_lineno += 1

    if post_context:
        for line in post_context:
            context.append((at_lineno, line))
            at_lineno += 1

    # HACK:
    if filename and is_url(filename) and '.' not in filename.rsplit('/', 1)[-1]:
        filename = 'index.html'

    return context


def is_newest_frame_first(event):
    newest_first = event.platform not in ('python', None)

    if env.request and env.request.user.is_authenticated():
        display = UserOption.objects.get_value(
            user=env.request.user,
            key='stacktrace_order',
            default=None,
        )
        if display == '1':
            newest_first = False
        elif display == '2':
            newest_first = True

    return newest_first


def is_url(filename):
    return filename.startswith(('file:', 'http:', 'https:', 'applewebdata:'))


def remove_function_outliers(function):
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


def remove_filename_outliers(filename, platform=None):
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


def remove_module_outliers(module, platform=None):
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


def slim_frame_data(frames, frame_allowance=settings.SENTRY_MAX_STACKTRACE_FRAMES):
    """
    Removes various excess metadata from middle frames which go beyond
    ``frame_allowance``.
    """
    frames_len = 0
    app_frames = []
    system_frames = []
    for frame in frames:
        frames_len += 1
        if frame is not None and frame.in_app:
            app_frames.append(frame)
        else:
            system_frames.append(frame)

    if frames_len <= frame_allowance:
        return

    remaining = frames_len - frame_allowance
    app_count = len(app_frames)
    system_allowance = max(frame_allowance - app_count, 0)
    if system_allowance:
        half_max = system_allowance / 2
        # prioritize trimming system frames
        for frame in system_frames[half_max:-half_max]:
            frame.vars = None
            frame.pre_context = None
            frame.post_context = None
            remaining -= 1

    else:
        for frame in system_frames:
            frame.vars = None
            frame.pre_context = None
            frame.post_context = None
            remaining -= 1

    if not remaining:
        return

    app_allowance = app_count - remaining
    half_max = app_allowance / 2

    for frame in app_frames[half_max:-half_max]:
        frame.vars = None
        frame.pre_context = None
        frame.post_context = None


def validate_bool(value, required=True):
    if required:
        assert value in (True, False)
    else:
        assert value in (True, False, None)
    return value


def handle_nan(value):
    "Remove nan values that can't be json encoded"
    if isinstance(value, float):
        if value == float('inf'):
            return '<inf>'
        if value == float('-inf'):
            return '<-inf>'
        # lol checking for float('nan')
        if value != value:
            return '<nan>'
    return value


def is_recursion(frame1, frame2):
    "Returns a boolean indicating whether frames are recursive calls."
    for field in RECURSION_COMPARISON_FIELDS:
        if getattr(frame1, field, None) != getattr(frame2, field, None):
            return False

    return True


class Frame(Interface):
    grouping_variants = ['system', 'app']

    @classmethod
    def to_python(cls, data, raw=False):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid stack frame data.")

        abs_path = data.get('abs_path')
        filename = data.get('filename')
        symbol = data.get('symbol')
        function = data.get('function')
        module = data.get('module')
        package = data.get('package')

        # For legacy reasons
        if function in ('?', ''):
            function = None

        # For consistency reasons
        if symbol in ('?', ''):
            symbol = None

        # Some of this processing should only be done for non raw frames
        if not raw:
            # absolute path takes priority over filename
            # (in the end both will get set)
            if not abs_path:
                abs_path = filename
                filename = None

            if not filename and abs_path:
                if is_url(abs_path):
                    urlparts = urlparse(abs_path)
                    if urlparts.path:
                        filename = urlparts.path
                    else:
                        filename = abs_path
                else:
                    filename = abs_path

        platform = data.get('platform')

        context_locals = data.get('vars') or {}
        if isinstance(context_locals, (list, tuple)):
            context_locals = dict(enumerate(context_locals))
        elif not isinstance(context_locals, dict):
            context_locals = {}
        context_locals = trim_dict(context_locals, object_hook=handle_nan)

        # extra data is used purely by internal systems,
        # so we dont trim it
        extra_data = data.get('data') or {}
        if isinstance(extra_data, (list, tuple)):
            extra_data = dict(enumerate(extra_data))

        # XXX: handle lines which were sent as 'null'
        context_line = trim(data.get('context_line'), 256)
        pre_context = data.get('pre_context', None)
        if isinstance(pre_context, list) and pre_context:
            pre_context = [c or '' for c in pre_context]
        else:
            pre_context = None

        post_context = data.get('post_context', None)
        if isinstance(post_context, list) and post_context:
            post_context = [c or '' for c in post_context]
        else:
            post_context = None

        if not context_line and (pre_context or post_context):
            context_line = ''

        in_app = validate_bool(data.get('in_app'), False)

        kwargs = {
            'abs_path': trim(abs_path, 2048),
            'filename': trim(filename, 256),
            'platform': platform,
            'module': trim(module, 256),
            'function': trim(function, 256),
            'package': package,
            'image_addr': to_hex_addr(data.get('image_addr')),
            'symbol': trim(symbol, 256),
            'symbol_addr': to_hex_addr(data.get('symbol_addr')),
            'instruction_addr': to_hex_addr(data.get('instruction_addr')),
            'trust': trim(data.get('trust'), 16),
            'in_app': in_app,
            'context_line': context_line,
            # TODO(dcramer): trim pre/post_context
            'pre_context': pre_context,
            'post_context': post_context,
            'vars': context_locals or None,
            'data': extra_data or None,
            'errors': data.get('errors'),
        }

        if data.get('lineno') is not None:
            lineno = int(data['lineno'])
            if lineno < 0:
                lineno = None
            kwargs['lineno'] = lineno
        else:
            kwargs['lineno'] = None

        if data.get('colno') is not None:
            colno = int(data['colno'])
            if colno < 0:
                colno = None
            kwargs['colno'] = colno
        else:
            kwargs['colno'] = None

        return cls(**kwargs)

    def to_json(self):
        return prune_empty_keys({
            'abs_path': self.abs_path or None,
            'filename': self.filename or None,
            'platform': self.platform or None,
            'module': self.module or None,
            'function': self.function or None,
            'package': self.package or None,
            'image_addr': self.image_addr,
            'symbol': self.symbol,
            'symbol_addr': self.symbol_addr,
            'instruction_addr': self.instruction_addr,
            'trust': self.trust,
            'in_app': self.in_app,
            'context_line': self.context_line,
            'pre_context': self.pre_context or None,
            'post_context': self.post_context or None,
            'vars': self.vars or None,
            'data': self.data or None,
            'errors': self.errors or None,
            'lineno': self.lineno,
            'colno': self.colno
        })

    def get_grouping_component(self, platform=None, variant=None):
        platform = self.platform or platform

        # In certain situations we want to disregard the entire frame.
        contributes = None
        hint = None

        # Safari throws [native code] frames in for calls like ``forEach``
        # whereas Chrome ignores these. Let's remove it from the hashing algo
        # so that they're more likely to group together
        filename_component = GroupingComponent(id='filename')
        if self.filename == '<anonymous>':
            filename_component.update(
                contributes=False,
                values=[self.filename],
                hint='anonymous filename discarded'
            )
        elif self.filename == '[native code]':
            contributes = False
            hint = 'native code indicated by filename'
        elif self.filename:
            if self.is_url():
                filename_component.update(
                    contributes=False,
                    values=[self.filename],
                    hint='ignored because filename is a URL',
                )
            elif self.is_caused_by():
                filename_component.update(
                    values=[self.filename],
                    contributes=False,
                    hint='ignored because invalid'
                )
            else:
                hashable_filename, hashable_filename_hint = \
                    remove_filename_outliers(self.filename, platform)
                filename_component.update(
                    values=[hashable_filename],
                    hint=hashable_filename_hint
                )

        # if we have a module we use that for grouping.  This will always
        # take precedence over the filename, even if the module is
        # considered unhashable.
        module_component = GroupingComponent(id='module')
        if self.module:
            if self.is_unhashable_module(platform):
                module_component.update(
                    values=[GroupingComponent(id='salt', values=['<module>'])],
                    hint='ignored module',
                )
            else:
                module_name, module_hint = \
                    remove_module_outliers(self.module, platform)
                module_component.update(
                    values=[module_name],
                    hint=module_hint
                )
            if self.filename:
                filename_component.update(
                    values=[self.filename],
                    contributes=False,
                    hint='module takes precedence'
                )

        # Context line when available is the primary contributor
        context_line_component = GroupingComponent(id='context-line')
        if self.context_line is not None:
            if len(self.context_line) > 120:
                context_line_component.update(hint='discarded because line too long')
            elif self.is_url() and not self.function:
                context_line_component.update(hint='discarded because from URL origin')
            else:
                context_line_component.update(values=[self.context_line])

        symbol_component = GroupingComponent(id='symbol')
        function_component = GroupingComponent(id='function')
        lineno_component = GroupingComponent(id='lineno')

        # The context line grouping information is the most reliable one.
        # If we did not manage to find some information there, we want to
        # see if we can come up with some extra information.  We only want
        # to do that if we managed to get a module of filename.
        if not context_line_component.contributes and \
           (module_component.contributes or filename_component.contributes):
            if self.symbol:
                symbol_component.update(values=[self.symbol])
                if self.function:
                    function_component.update(
                        contributes=False,
                        values=[self.function],
                        hint='symbol takes precedence'
                    )
                if self.lineno:
                    lineno_component.update(
                        contributes=False,
                        values=[self.lineno],
                        hint='symbol takes precedence'
                    )
            elif self.function:
                if self.is_unhashable_function():
                    function_component.update(values=[
                        GroupingComponent(
                            id='salt',
                            values=['<function>']
                        )
                    ])
                else:
                    function, function_hint = remove_function_outliers(self.function)
                    function_component.update(
                        values=[function],
                        hint=function_hint
                    )
                if self.lineno:
                    lineno_component.update(
                        contributes=False,
                        values=[self.lineno],
                        hint='function takes precedence'
                    )
            elif self.lineno:
                lineno_component.update(values=[self.lineno])
        else:
            if self.symbol:
                symbol_component.update(
                    contributes=False,
                    values=[self.symbol],
                    hint='symbol is used only if module or filename are available'
                )
            if self.function:
                function_component.update(
                    contributes=False,
                    values=[self.function],
                    hint='function name is used only if module or filename are available'
                )
            if self.lineno:
                lineno_component.update(
                    contributes=False,
                    values=[self.lineno],
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

    def get_api_context(self, is_public=False, pad_addr=None):
        data = {
            'filename': self.filename,
            'absPath': self.abs_path,
            'module': self.module,
            'package': self.package,
            'platform': self.platform,
            'instructionAddr': pad_hex_addr(self.instruction_addr, pad_addr),
            'symbolAddr': pad_hex_addr(self.symbol_addr, pad_addr),
            'function': self.function,
            'symbol': self.symbol,
            'context': get_context(
                lineno=self.lineno,
                context_line=self.context_line,
                pre_context=self.pre_context,
                post_context=self.post_context,
                filename=self.filename or self.module,
            ),
            'lineNo': self.lineno,
            'colNo': self.colno,
            'inApp': self.in_app,
            'trust': self.trust,
            'errors': self.errors,
        }
        if not is_public:
            data['vars'] = self.vars
        # TODO(dcramer): abstract out this API
        if self.data:
            data.update(
                {
                    'map': self.data['sourcemap'].rsplit('/', 1)[-1],
                    'origFunction': self.data.get('orig_function', '?'),
                    'origAbsPath': self.data.get('orig_abs_path', '?'),
                    'origFilename': self.data.get('orig_filename', '?'),
                    'origLineNo': self.data.get('orig_lineno', '?'),
                    'origColNo': self.data.get('orig_colno', '?'),
                }
            )
            if is_url(self.data['sourcemap']):
                data['mapUrl'] = self.data['sourcemap']

        return data

    def get_meta_context(self, meta, is_public=False):
        if not meta:
            return

        return {
            'filename': meta.get('filename'),
            'absPath': meta.get('abs_path'),
            'module': meta.get('module'),
            'package': meta.get('package'),
            'platform': meta.get('platform'),
            'instructionAddr': meta.get('instruction_addr'),
            'symbolAddr': meta.get('symbol_addr'),
            'function': meta.get('function'),
            'symbol': meta.get('symbol'),
            'context': get_context(
                lineno=meta.get('lineno'),
                context_line=meta.get('context_line'),
                pre_context=meta.get('pre_context'),
                post_context=meta.get('post_context'),
                filename=meta.get('filename') if self.filename else meta.get('module'),
            ),
            'lineNo': meta.get('lineno'),
            'colNo': meta.get('colno'),
            'inApp': meta.get('in_app'),
            'trust': meta.get('trust'),
            'errors': meta.get('errors'),
        }

    def is_url(self):
        if not self.abs_path:
            return False
        # URLs can be generated such that they are:
        #   blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0
        # https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
        if self.abs_path.startswith('blob:'):
            return True
        return is_url(self.abs_path)

    def is_caused_by(self):
        # XXX(dcramer): dont compute hash using frames containing the 'Caused by'
        # text as it contains an exception value which may may contain dynamic
        # values (see raven-java#125)
        return self.filename.startswith('Caused by: ')

    def is_unhashable_module(self, platform):
        # Fix for the case where module is a partial copy of the URL
        # and should not be hashed
        if (platform == 'javascript' and '/' in self.module
                and self.abs_path and self.abs_path.endswith(self.module)):
            return True
        elif platform == 'java' and '$$Lambda$' in self.module:
            return True
        return False

    def is_unhashable_function(self):
        # TODO(dcramer): lambda$ is Java specific
        # TODO(dcramer): [Anonymous is PHP specific (used for things like SQL
        # queries and JSON data)
        return self.function.startswith(('lambda$', '[Anonymous'))

    def to_string(self, event):
        if event.platform is not None:
            choices = [event.platform]
        else:
            choices = []
        choices.append('default')
        templates = ['sentry/partial/frames/%s.txt' % choice for choice in choices]
        return render_to_string(
            templates, {
                'abs_path': self.abs_path,
                'filename': self.filename,
                'function': self.function,
                'module': self.module,
                'lineno': self.lineno,
                'colno': self.colno,
                'context_line': self.context_line,
            }
        ).strip('\n')


class Stacktrace(Interface):
    """
    A stacktrace contains a list of frames, each with various bits (most optional)
    describing the context of that frame. Frames should be sorted from oldest
    to newest.

    The stacktrace contains an element, ``frames``, which is a list of hashes. Each
    hash must contain **at least** the ``filename`` attribute. The rest of the values
    are optional, but recommended.

    Additionally, if the list of frames is large, you can explicitly tell the
    system that you've omitted a range of frames. The ``frames_omitted`` must
    be a single tuple two values: start and end. For example, if you only
    removed the 8th frame, the value would be (8, 9), meaning it started at the
    8th frame, and went until the 9th (the number of frames omitted is
    end-start). The values should be based on a one-index.

    The list of frames should be ordered by the oldest call first.

    Each frame must contain the following attributes:

    ``filename``
      The relative filepath to the call

    OR

    ``function``
      The name of the function being called

    OR

    ``module``
      Platform-specific module path (e.g. stacktrace)

    The following additional attributes are supported:

    ``lineno``
      The line number of the call
    ``colno``
      The column number of the call
    ``abs_path``
      The absolute path to filename
    ``context_line``
      Source code in filename at lineno
    ``pre_context``
      A list of source code lines before context_line (in order) -- usually [lineno - 5:lineno]
    ``post_context``
      A list of source code lines after context_line (in order) -- usually [lineno + 1:lineno + 5]
    ``in_app``
      Signifies whether this frame is related to the execution of the relevant
      code in this stacktrace. For example, the frames that might power the
      framework's webserver of your app are probably not relevant, however calls
      to the framework's library once you start handling code likely are. See
      notes below on implicity ``in_app`` behavior.
    ``vars``
      A mapping of variables which were available within this frame (usually context-locals).
    ``package``
      Name of the package or object file that the frame is contained in.  This
      for instance can be the name of a DLL, .NET Assembly, jar file, object
      file etc.

    >>> {
    >>>     "frames": [{
    >>>         "abs_path": "/real/file/name.py"
    >>>         "filename": "file/name.py",
    >>>         "function": "myfunction",
    >>>         "vars": {
    >>>             "key": "value"
    >>>         },
    >>>         "pre_context": [
    >>>             "line1",
    >>>             "line2"
    >>>         ],
    >>>         "context_line": "line3",
    >>>         "lineno": 3,
    >>>         "in_app": true,
    >>>         "post_context": [
    >>>             "line4",
    >>>             "line5"
    >>>         ],
    >>>     }],
    >>>     "frames_omitted": [13, 56]
    >>> }

    Implicity ``in_app`` behavior exists when the value is not specified on all
    frames within a stacktrace (or collectively within an exception if this is
    part of a chain).

    If **any frame** is marked with ``in_app=True`` or ``in_app=False``:

    - Set ``in_app=False`` where ``in_app is None``

    If **all frames** are marked identical values for ``in_app``:

    - Set ``in_app=False`` on all frames

    .. note:: This interface can be passed as the 'stacktrace' key in addition
              to the full interface path.
    """
    score = 1950
    grouping_variants = ['system', 'app']

    def __iter__(self):
        return iter(self.frames)

    @classmethod
    def to_python(cls, data, slim_frames=True, raw=False):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid stack frame data.")

        # Trim down the frame list to a hard limit. Leave the last frame in place in case
        # it's useful for debugging.
        frameiter = data.get('frames') or []
        if len(frameiter) > settings.SENTRY_STACKTRACE_FRAMES_HARD_LIMIT:
            frameiter = chain(
                islice(data['frames'], settings.SENTRY_STACKTRACE_FRAMES_HARD_LIMIT - 1), (data['frames'][-1],))

        frame_list = []

        for f in frameiter:
            if f is None:
                continue
            # XXX(dcramer): handle PHP sending an empty array for a frame
            frame_list.append(Frame.to_python(f or {}, raw=raw))

        kwargs = {
            'frames': frame_list,
        }

        kwargs['registers'] = None
        if data.get('registers') and isinstance(data['registers'], dict):
            kwargs['registers'] = data.get('registers')

        kwargs['frames_omitted'] = data.get('frames_omitted') or None

        instance = cls(**kwargs)
        if slim_frames:
            slim_frame_data(instance)
        return instance

    def get_has_system_frames(self):
        # This is a simplified logic from how the normalizer works.
        # Because this always works on normalized data we do not have to
        # consider the "all frames are in_app" case.  The normalizer lives
        # in stacktraces.normalize_in_app which will take care of that.
        return any(frame.in_app for frame in self.frames)

    def get_longest_address(self):
        rv = None
        for frame in self.frames:
            rv = max_addr(rv, frame.instruction_addr)
            rv = max_addr(rv, frame.symbol_addr)
        return rv

    def get_api_context(self, is_public=False):
        longest_addr = self.get_longest_address()

        frame_list = [
            f.get_api_context(is_public=is_public, pad_addr=longest_addr) for f in self.frames
        ]

        return {
            'frames': frame_list,
            'framesOmitted': self.frames_omitted,
            'registers': self.registers,
            'hasSystemFrames': self.get_has_system_frames(),
        }

    def get_api_meta(self, meta, is_public=False):
        if not meta:
            return meta

        frame_meta = {}
        for index, value in six.iteritems(meta.get('frames', {})):
            if index == '':
                continue
            frame = self.frames[int(index)]
            frame_meta[index] = frame.get_api_meta(value, is_public=is_public)

        return {
            '': meta.get(''),
            'frames': frame_meta,
            'framesOmitted': meta.get('frames_omitted'),
            'registers': meta.get('registers'),
        }

    def to_json(self):
        return prune_empty_keys({
            'frames': [f and f.to_json() for f in self.frames] or None,
            'frames_omitted': self.frames_omitted,
            'registers': self.registers,
        })

    def get_grouping_component(self, platform=None, variant=None):
        frames = self.frames
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
            frame_component = frame.get_grouping_component(platform, variant)
            if variant == 'app' and not frame.in_app and not all_frames_considered_in_app:
                frame_component.update(
                    contributes=False,
                    hint='non app frame',
                )
            elif prev_frame is not None and is_recursion(frame, prev_frame):
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

    def to_string(self, event, is_public=False, **kwargs):
        return self.get_stacktrace(event, system_frames=False, max_frames=10)

    def get_stacktrace(
        self, event, system_frames=True, newest_first=None, max_frames=None, header=True
    ):
        if newest_first is None:
            newest_first = is_newest_frame_first(event)

        result = []
        if header:
            if newest_first:
                result.append(_('Stacktrace (most recent call first):'))
            else:
                result.append(_('Stacktrace (most recent call last):'))

            result.append('')

        frames = self.frames

        num_frames = len(frames)

        if not system_frames:
            frames = [f for f in frames if f.in_app is not False]
            if not frames:
                frames = self.frames

        if newest_first:
            frames = frames[::-1]

        if max_frames:
            visible_frames = max_frames
            if newest_first:
                start, stop = None, max_frames
            else:
                start, stop = -max_frames, None

        else:
            visible_frames = len(frames)
            start, stop = None, None

        if not newest_first and visible_frames < num_frames:
            result.extend(
                (
                    '(%d additional frame(s) were not displayed)' % (num_frames - visible_frames, ),
                    '...'
                )
            )

        for frame in frames[start:stop]:
            result.append(frame.to_string(event))

        if newest_first and visible_frames < num_frames:
            result.extend(
                (
                    '...',
                    '(%d additional frame(s) were not displayed)' % (num_frames - visible_frames, )
                )
            )

        return '\n'.join(result)
