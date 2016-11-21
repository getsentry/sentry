"""
sentry.interfaces.stacktrace
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Stacktrace',)

import re
import six

from django.conf import settings
from django.utils.translation import ugettext as _
from six.moves.urllib.parse import urlparse

from sentry.app import env
from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.models import UserOption
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string
from sentry.constants import VALID_PLATFORMS


_ruby_anon_func = re.compile(r'_\d{2,}')
_filename_version_re = re.compile(r"""(?:
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/""", re.X | re.I)

# Java Spring specific anonymous classes.
# see: http://mydailyjava.blogspot.co.at/2013/11/cglib-missing-manual.html
_java_enhancer_re = re.compile(r'''
(\$\$[\w_]+?CGLIB\$\$)[a-fA-F0-9]+(_[0-9]+)?
''', re.X)


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
        raise ValueError('Unsupported address format %r' % (addr,))
    if len(rv) > 24:
        raise ValueError('Address too long %r' % (rv,))
    return rv


def get_context(lineno, context_line, pre_context=None, post_context=None,
                filename=None):
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
            project=None,
            key='stacktrace_order',
            default=None,
        )
        if display == '1':
            newest_first = False
        elif display == '2':
            newest_first = True

    return newest_first


def is_url(filename):
    return filename.startswith(('file:', 'http:', 'https:'))


def remove_function_outliers(function):
    """
    Attempt to normalize functions by removing common platform outliers.

    - Ruby generates (random?) integers for various anonymous style functions
      such as in erb and the active_support library.
    - Block functions have metadata that we don't care about.
    """
    if function.startswith('block '):
        return 'block'
    return _ruby_anon_func.sub('_<anon>', function)


def remove_filename_outliers(filename):
    """
    Attempt to normalize filenames by removing common platform outliers.

    - Sometimes filename paths contain build numbers
    """
    return _filename_version_re.sub('<version>/', filename)


def remove_module_outliers(module):
    """Remove things that augment the module but really should not."""
    if module[:35] == 'sun.reflect.GeneratedMethodAccessor':
        return 'sun.reflect.GeneratedMethodAccessor'
    return _java_enhancer_re.sub(r'\1<auto>', module)


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
        if frame.in_app:
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


class Frame(Interface):
    @classmethod
    def to_python(cls, data):
        abs_path = data.get('abs_path')
        filename = data.get('filename')
        symbol = data.get('symbol')
        function = data.get('function')
        module = data.get('module')
        package = data.get('package')

        for name in ('abs_path', 'filename', 'symbol', 'function', 'module',
                     'package'):
            v = data.get(name)
            if v is not None and not isinstance(v, six.string_types):
                raise InterfaceValidationError("Invalid value for '%s'" % name)

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

        if not (filename or function or module or package):
            raise InterfaceValidationError("No 'filename' or 'function' or "
                                           "'module' or 'package'")

        # For legacy reasons
        if function == '?':
            function = None

        # For consistency reasons
        if symbol == '?':
            symbol = None

        platform = data.get('platform')
        if platform not in VALID_PLATFORMS:
            platform = None

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
        if context_line is not None:
            pre_context = data.get('pre_context', None)
            if pre_context:
                pre_context = [c or '' for c in pre_context]

            post_context = data.get('post_context', None)
            if post_context:
                post_context = [c or '' for c in post_context]
        else:
            pre_context, post_context = None, None

        try:
            in_app = validate_bool(data.get('in_app'), False)
        except AssertionError:
            raise InterfaceValidationError("Invalid value for 'in_app'")

        instruction_offset = data.get('instruction_offset')
        if instruction_offset is not None and \
           not isinstance(instruction_offset, six.integer_types):
            raise InterfaceValidationError("Invalid value for 'instruction_offset'")

        kwargs = {
            'abs_path': trim(abs_path, 256),
            'filename': trim(filename, 256),
            'platform': platform,
            'module': trim(module, 256),
            'function': trim(function, 256),
            'package': package,
            'image_addr': to_hex_addr(data.get('image_addr')),
            'symbol': trim(symbol, 256),
            'symbol_addr': to_hex_addr(data.get('symbol_addr')),
            'instruction_addr': to_hex_addr(data.get('instruction_addr')),
            'instruction_offset': instruction_offset,
            'in_app': in_app,
            'context_line': context_line,
            # TODO(dcramer): trim pre/post_context
            'pre_context': pre_context,
            'post_context': post_context,
            'vars': context_locals,
            'data': extra_data,
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
            kwargs['colno'] = int(data['colno'])
        else:
            kwargs['colno'] = None

        return cls(**kwargs)

    def get_hash(self):
        """
        The hash of the frame varies depending on the data available.

        Our ideal scenario is the module name in addition to the line of
        context. However, in several scenarios we opt for other approaches due
        to platform constraints.

        This is one of the few areas in Sentry that isn't platform-agnostic.
        """
        output = []
        if self.module:
            if self.is_unhashable_module():
                output.append('<module>')
            else:
                output.append(remove_module_outliers(self.module))
        elif self.filename and not self.is_url() and not self.is_caused_by():
            output.append(remove_filename_outliers(self.filename))

        if self.context_line is None:
            can_use_context = False
        elif len(self.context_line) > 120:
            can_use_context = False
        elif self.is_url() and not self.function:
            # the context is too risky to use here as it could be something
            # coming from an HTML page or it could be minified/unparseable
            # code, so lets defer to other lesser heuristics (like lineno)
            can_use_context = False
        elif self.function and self.is_unhashable_function():
            can_use_context = True
        else:
            can_use_context = True

        # XXX: hack around what appear to be non-useful lines of context
        if can_use_context:
            output.append(self.context_line)
        elif not output:
            # If we were unable to achieve any context at this point
            # (likely due to a bad JavaScript error) we should just
            # bail on recording this frame
            return output
        elif self.symbol:
            output.append(self.symbol)
        elif self.function:
            if self.is_unhashable_function():
                output.append('<function>')
            else:
                output.append(remove_function_outliers(self.function))
        elif self.lineno is not None:
            output.append(self.lineno)
        return output

    def get_api_context(self, is_public=False, pad_addr=None):
        data = {
            'filename': self.filename,
            'absPath': self.abs_path,
            'module': self.module,
            'package': self.package,
            'platform': self.platform,
            'instructionAddr': pad_hex_addr(self.instruction_addr, pad_addr),
            'instructionOffset': self.instruction_offset,
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
            'errors': self.errors,
        }
        if not is_public:
            data['vars'] = self.vars
        # TODO(dcramer): abstract out this API
        if self.data:
            data.update({
                'map': self.data['sourcemap'].rsplit('/', 1)[-1],
                'origFunction': self.data.get('orig_function', '?'),
                'origAbsPath': self.data.get('orig_abs_path', '?'),
                'origFilename': self.data.get('orig_filename', '?'),
                'origLineNo': self.data.get('orig_lineno', '?'),
                'origColNo': self.data.get('orig_colno', '?'),
            })
            if is_url(self.data['sourcemap']):
                data['mapUrl'] = self.data['sourcemap']

        return data

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

    def is_unhashable_module(self):
        # TODO(dcramer): this is Java specific
        return '$$Lambda$' in self.module

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
        templates = [
            'sentry/partial/frames/%s.txt' % choice
            for choice in choices
        ]
        return render_to_string(templates, {
            'abs_path': self.abs_path,
            'filename': self.filename,
            'function': self.function,
            'module': self.module,
            'lineno': self.lineno,
            'colno': self.colno,
            'context_line': self.context_line,
        }).strip('\n')

    def get_culprit_string(self, platform=None):
        # If this frame has a platform, we use it instead of the one that
        # was passed in (as that one comes from the exception which might
        # not necessarily be the same platform).
        if self.platform is not None:
            platform = self.platform
        if platform in ('objc', 'cocoa'):
            return '%s (%s)' % (
                self.function or '?',
                trim_package(self.package),
            )
        fileloc = self.module or self.filename
        if not fileloc:
            return ''
        elif platform == 'javascript':
            return '{}({})'.format(self.function or '?', fileloc)
        return '%s in %s' % (
            fileloc,
            self.function or '?',
        )


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
      Platform-specific module path (e.g. sentry.interfaces.Stacktrace)

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
    score = 2000

    def __iter__(self):
        return iter(self.frames)

    @classmethod
    def to_python(cls, data, has_system_frames=None, slim_frames=True):
        if not data.get('frames'):
            raise InterfaceValidationError("No 'frames' present")

        if not isinstance(data['frames'], list):
            raise InterfaceValidationError("Invalid value for 'frames'")

        if has_system_frames is None:
            has_system_frames = cls.data_has_system_frames(data)

        frame_list = [
            # XXX(dcramer): handle PHP sending an empty array for a frame
            Frame.to_python(f or {})
            for f in data['frames']
        ]

        for frame in frame_list:
            if not has_system_frames:
                frame.in_app = False
            elif frame.in_app is None:
                frame.in_app = False

        kwargs = {
            'frames': frame_list,
        }

        if data.get('frames_omitted'):
            if len(data['frames_omitted']) != 2:
                raise InterfaceValidationError("Invalid value for 'frames_omitted'")
            kwargs['frames_omitted'] = data['frames_omitted']
        else:
            kwargs['frames_omitted'] = None

        kwargs['has_system_frames'] = has_system_frames

        instance = cls(**kwargs)
        if slim_frames:
            slim_frame_data(instance)
        return instance

    @classmethod
    def data_has_system_frames(cls, data):
        system_frames = 0
        for frame in data['frames']:
            # XXX(dcramer): handle PHP sending an empty array for a frame
            if not isinstance(frame, dict):
                continue
            if not frame.get('in_app'):
                system_frames += 1

        if len(data['frames']) == system_frames:
            return False
        return bool(system_frames)

    def get_longest_address(self):
        rv = None
        for frame in self.frames:
            rv = max_addr(rv, frame.instruction_addr)
            rv = max_addr(rv, frame.symbol_addr)
        return rv

    def get_api_context(self, is_public=False):
        longest_addr = self.get_longest_address()

        frame_list = [
            f.get_api_context(is_public=is_public, pad_addr=longest_addr)
            for f in self.frames
        ]

        return {
            'frames': frame_list,
            'framesOmitted': self.frames_omitted,
            'hasSystemFrames': self.has_system_frames,
        }

    def to_json(self):
        return {
            'frames': [f.to_json() for f in self.frames],
            'frames_omitted': self.frames_omitted,
            'has_system_frames': self.has_system_frames,
        }

    def get_path(self):
        return 'sentry.interfaces.Stacktrace'

    def compute_hashes(self, platform):
        system_hash = self.get_hash(system_frames=True)
        if not system_hash:
            return []

        app_hash = self.get_hash(system_frames=False)
        if system_hash == app_hash or not app_hash:
            return [system_hash]

        return [system_hash, app_hash]

    def get_hash(self, system_frames=True):
        frames = self.frames

        # TODO(dcramer): this should apply only to platform=javascript
        # Browser JS will often throw errors (from inlined code in an HTML page)
        # which contain only a single frame, no function name, and have the HTML
        # document as the filename. In this case the hash is often not usable as
        # the context cannot be trusted and the URL is dynamic (this also means
        # the line number cannot be trusted).
        stack_invalid = (
            len(frames) == 1 and not frames[0].function and frames[0].is_url()
        )

        if stack_invalid:
            return []

        if not system_frames:
            total_frames = len(frames)
            frames = [f for f in frames if f.in_app] or frames

            # if app frames make up less than 10% of the stacktrace discard
            # the hash as invalid
            if len(frames) / float(total_frames) < 0.10:
                return []

        output = []
        for frame in frames:
            output.extend(frame.get_hash())
        return output

    def to_string(self, event, is_public=False, **kwargs):
        return self.get_stacktrace(event, system_frames=False, max_frames=10)

    def get_stacktrace(self, event, system_frames=True, newest_first=None,
                       max_frames=None, header=True):
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
            result.extend(('(%d additional frame(s) were not displayed)' % (num_frames - visible_frames,), '...'))

        for frame in frames[start:stop]:
            result.append(frame.to_string(event))

        if newest_first and visible_frames < num_frames:
            result.extend(('...', '(%d additional frame(s) were not displayed)' % (num_frames - visible_frames,)))

        return '\n'.join(result)

    def get_traceback(self, event, newest_first=None):
        result = [
            event.message, '',
            self.get_stacktrace(event, newest_first=newest_first),
        ]

        return '\n'.join(result)

    def get_culprit_string(self, platform=None):
        default = None
        for frame in reversed(self.frames):
            if frame.in_app:
                return frame.get_culprit_string(platform=platform)
            elif default is None:
                default = frame.get_culprit_string(platform=platform)
        return default
