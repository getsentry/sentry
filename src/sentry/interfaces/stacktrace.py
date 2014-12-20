"""
sentry.interfaces.stacktrace
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Stacktrace',)

import re

from django.conf import settings
from django.utils.translation import ugettext as _
from urlparse import urljoin, urlparse

from sentry.app import env
from sentry.interfaces.base import Interface
from sentry.models import UserOption
from sentry.utils.safe import trim, trim_dict
from sentry.web.helpers import render_to_string


_ruby_anon_func = re.compile(r'_\d{2,}')
_filename_version_re = re.compile(r"""(?:
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/""", re.X | re.I)


def get_context(lineno, context_line, pre_context=None, post_context=None, filename=None):
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
    return '://' in filename


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


def trim_frames(stacktrace, max_frames=settings.SENTRY_MAX_STACKTRACE_FRAMES):
    # TODO: this doesnt account for cases where the client has already omitted
    # frames
    frames = stacktrace['frames']
    frames_len = len(frames)

    if frames_len <= max_frames:
        return

    half_max = max_frames / 2

    stacktrace['frames_omitted'] = (half_max, frames_len - half_max)

    for n in xrange(half_max, frames_len - half_max):
        del frames[half_max]


def validate_bool(value, required=True):
    if required:
        assert value in (True, False)
    else:
        assert value in (True, False, None)
    return value


class Frame(Interface):
    @classmethod
    def to_python(cls, data):
        abs_path = data.get('abs_path')
        filename = data.get('filename')

        if not abs_path:
            abs_path = filename

        if not filename:
            filename = abs_path

        if abs_path and is_url(abs_path):
            urlparts = urlparse(abs_path)
            if urlparts.path:
                filename = urlparts.path

        assert filename or data.get('function') or data.get('module')

        context_locals = data.get('vars') or {}
        if isinstance(context_locals, (list, tuple)):
            context_locals = dict(enumerate(context_locals))
        elif not isinstance(context_locals, dict):
            context_locals = {}
        context_locals = trim_dict(context_locals)

        # extra data is used purely by internal systems,
        # so we dont trim it
        extra_data = data.get('data') or {}
        if isinstance(extra_data, (list, tuple)):
            extra_data = dict(enumerate(extra_data))

        kwargs = {
            'abs_path': trim(abs_path, 256),
            'filename': trim(filename, 256),
            'module': trim(data.get('module'), 256),
            'function': trim(data.get('function'), 256),
            'in_app': validate_bool(data.get('in_app'), False),
            'context_line': trim(data.get('context_line'), 256),
            # TODO(dcramer): trim pre/post_context
            'pre_context': data.get('pre_context'),
            'post_context': data.get('post_context'),
            'vars': context_locals,
            'data': extra_data,
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

    def is_url(self):
        if not self.abs_path:
            return False
        return is_url(self.abs_path)

    def is_caused_by(self):
        # XXX(dcramer): dont compute hash using frames containing the 'Caused by'
        # text as it contains an exception value which may may contain dynamic
        # values (see raven-java#125)
        return self.filename.startswith('Caused by: ')

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
            output.append(self.module)
        elif self.filename and not self.is_url() and not self.is_caused_by():
            output.append(remove_filename_outliers(self.filename))

        if self.context_line is None:
            can_use_context = False
        elif len(self.context_line) > 120:
            can_use_context = False
        # XXX: deal with PHP anonymous functions (used for things like SQL
        # queries and JSON data)
        elif self.function and self.function.startswith('[Anonymous'):
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
        elif self.function:
            output.append(remove_function_outliers(self.function))
        elif self.lineno is not None:
            output.append(self.lineno)
        return output

    def get_context(self, event, is_public=False, **kwargs):
        if (self.context_line and self.lineno is not None
                and (self.pre_context or self.post_context)):
            context = get_context(
                lineno=self.lineno,
                context_line=self.context_line,
                pre_context=self.pre_context,
                post_context=self.post_context,
                filename=self.filename or self.module,
            )
            start_lineno = context[0][0]
        else:
            context = []
            start_lineno = None

        frame_data = {
            'abs_path': self.abs_path,
            'filename': self.filename,
            'module': self.module,
            'function': self.function,
            'start_lineno': start_lineno,
            'lineno': self.lineno,
            'colno': self.colno,
            'context': context,
            'context_line': self.context_line,
            'in_app': self.in_app,
            'is_url': self.is_url(),
        }
        if not is_public:
            frame_data['vars'] = self.vars or {}

        if event.platform == 'javascript' and self.data:
            frame_data.update({
                'sourcemap': self.data['sourcemap'].rsplit('/', 1)[-1],
                'sourcemap_url': urljoin(self.abs_path, self.data['sourcemap']),
                'orig_function': self.data.get('orig_function', '?'),
                'orig_abs_path': self.data.get('orig_abs_path', '?'),
                'orig_filename': self.data.get('orig_filename', '?'),
                'orig_lineno': self.data.get('orig_lineno', '?'),
                'orig_colno': self.data.get('orig_colno', '?'),
            })
        return frame_data

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
      Signifies whether this frame is related to the execution of the relevant code in this stacktrace. For example,
      the frames that might power the framework's webserver of your app are probably not relevant, however calls to
      the framework's library once you start handling code likely are.
    ``vars``
      A mapping of variables which were available within this frame (usually context-locals).

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

    .. note:: This interface can be passed as the 'stacktrace' key in addition
              to the full interface path.
    """
    score = 1000

    def __iter__(self):
        return iter(self.frames)

    @classmethod
    def to_python(cls, data):
        assert data.get('frames')

        trim_frames(data)

        kwargs = {
            'frames': [
                Frame.to_python(f)
                for f in data['frames']
            ],
        }

        if data.get('frames_omitted'):
            assert len(data['frames_omitted']) == 2
            kwargs['frames_omitted'] = data['frames_omitted']
        else:
            kwargs['frames_omitted'] = None

        return cls(**kwargs)

    def to_json(self):
        return {
            'frames': [f.to_json() for f in self.frames],
            'frames_omitted': self.frames_omitted,
        }

    def get_path(self):
        return 'sentry.interfaces.Stacktrace'

    def has_app_frames(self):
        return any(f.in_app is not None for f in self.frames)

    def compute_hashes(self):
        system_hash = self.get_hash(system_frames=True)
        if not system_hash:
            return []

        app_hash = self.get_hash(system_frames=False)
        if system_hash == app_hash or not app_hash:
            return [system_hash]

        return [system_hash, app_hash]

    def get_hash(self, system_frames=True):
        frames = self.frames

        # TODO(dcramer): this should apply only to JS
        if len(frames) == 1 and frames[0].lineno == 1 and frames[0].function in ('?', None):
            return []

        if not system_frames:
            frames = [f for f in frames if f.in_app] or frames

        output = []
        for frame in frames:
            output.extend(frame.get_hash())
        return output

    def get_context(self, event, is_public=False, newest_first=None,
                    with_stacktrace=True, **kwargs):
        system_frames = 0
        frames = []
        for frame in self.frames:
            frames.append(frame.get_context(event=event, is_public=is_public))

            if not frame.in_app:
                system_frames += 1

        if len(frames) == system_frames:
            system_frames = 0

        # if theres no system frames, pretend they're all part of the app
        if not system_frames:
            for frame in frames:
                frame['in_app'] = True

        if newest_first is None:
            newest_first = is_newest_frame_first(event)
        if newest_first:
            frames = frames[::-1]

        if self.frames_omitted:
            first_frame_omitted, last_frame_omitted = self.frames_omitted
        else:
            first_frame_omitted, last_frame_omitted = None, None

        context = {
            'is_public': is_public,
            'newest_first': newest_first,
            'system_frames': system_frames,
            'event': event,
            'frames': frames,
            'stack_id': 'stacktrace_1',
            'first_frame_omitted': first_frame_omitted,
            'last_frame_omitted': last_frame_omitted,
        }
        if with_stacktrace:
            context['stacktrace'] = self.get_traceback(event, newest_first=newest_first)
        return context

    def to_html(self, event, **kwargs):
        context = self.get_context(
            event=event,
            **kwargs
        )
        return render_to_string('sentry/partial/interfaces/stacktrace.html', context)

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
