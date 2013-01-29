"""
sentry.interfaces
~~~~~~~~~~~~~~~~~

Interfaces provide an abstraction for how structured data should be
validated and rendered.

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import itertools
import urlparse

from pygments import highlight
from pygments.lexers import get_lexer_for_filename, TextLexer, ClassNotFound
from pygments.formatters import HtmlFormatter

from django.http import QueryDict
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext as _

from sentry.app import env
from sentry.models import UserOption
from sentry.web.helpers import render_to_string

_Exception = Exception


def unserialize(klass, data):
    value = object.__new__(klass)
    value.__setstate__(data)
    return value


def get_context(lineno, context_line, pre_context=None, post_context=None, filename=None,
        format=False):
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

    context.append((at_lineno, context_line))
    at_lineno += 1

    if post_context:
        for line in post_context:
            context.append((at_lineno, line))
            at_lineno += 1

    # HACK:
    if filename.startswith(('http:', 'https:')) and '.' not in filename.rsplit('/', 1)[-1]:
        filename = 'index.html'

    if format:
        try:
            lexer = get_lexer_for_filename(filename)
        except ClassNotFound:
            lexer = TextLexer()

        formatter = HtmlFormatter()

        def format(line):
            if not line:
                return mark_safe('<pre></pre>')
            return mark_safe(highlight(line, lexer, formatter))

        context = tuple((n, format(l)) for n, l in context)

    return context


class Interface(object):
    """
    An interface is a structured represntation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    score = 0
    display_score = None

    def __init__(self, **kwargs):
        self.attrs = kwargs.keys()
        self.__dict__.update(kwargs)

    def __setstate__(self, data):
        kwargs = self.unserialize(data)
        self.attrs = kwargs.keys()
        self.__dict__.update(kwargs)

    def __getstate__(self):
        return self.serialize()

    def unserialize(self, data):
        return data

    def serialize(self):
        return dict((k, self.__dict__[k]) for k in self.attrs)

    def get_composite_hash(self, interfaces):
        return self.get_hash()

    def get_hash(self):
        return []

    def to_html(self, event):
        return ''

    def to_string(self, event):
        return ''

    def get_slug(self):
        return type(self).__name__.lower()

    def get_title(self):
        return _(type(self).__name__)

    def get_display_score(self):
        return self.display_score or self.score

    def get_score(self):
        return self.score

    def get_search_context(self, event):
        """
        Returns a dictionary describing the data that should be indexed
        by the search engine. Several fields are accepted:

        - text: a list of text items to index as part of the generic query
        - filters: a map of fields which are used for precise matching
        """
        return {
            # 'text': ['...'],
            # 'filters': {
            #     'field": ['...'],
            # },
        }


class Message(Interface):
    """
    A standard message consisting of a ``message`` arg, and an optional
    ``params`` arg for formatting.

    If your message cannot be parameterized, then the message interface
    will serve no benefit.

    - ``message`` must be no more than 1000 characters in length.

    >>> {
    >>>     "message": "My raw message with interpreted strings like %s",
    >>>     "params": ["this"]
    >>> }
    """

    def __init__(self, message, params=()):
        assert len(message) <= 1000

        self.message = message
        self.params = params

    def serialize(self):
        return {
            'message': self.message,
            'params': self.params,
        }

    def get_hash(self):
        return [self.message]

    def get_search_context(self, event):
        if isinstance(self.params, (list, tuple)):
            params = list(self.params)
        elif isinstance(self.params, dict):
            params = self.params.values()
        else:
            params = []
        return {
            'text': [self.message] + params,
        }


class Query(Interface):
    """
    A SQL query with an optional string describing the SQL driver, ``engine``.

    >>> {
    >>>     "query": "SELECT 1"
    >>>     "engine": "psycopg2"
    >>> }
    """

    def __init__(self, query, engine=None):
        self.query = query
        self.engine = engine

    def get_hash(self):
        return [self.query]

    def serialize(self):
        return {
            'query': self.query,
            'engine': self.engine,
        }

    def get_search_context(self, event):
        return {
            'text': [self.query],
        }


class Stacktrace(Interface):
    """
    A stacktrace contains a list of frames, each with various bits (most optional)
    describing the context of that frame. Frames should be sorted with the most recent
    caller being the last in the list.

    The stacktrace contains one element, ``frames``, which is a list of hashes. Each
    hash must contain **at least** the ``filename`` attribute. The rest of the values
    are optional, but recommended.

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
    >>>     }]
    >>> }

    """
    score = 1000

    def __init__(self, frames):
        self.frames = frames
        for frame in frames:
            # if for some reason the user provided abs_path but not filename
            # let it through and fix it for them
            if 'abs_path' in frame and 'filename' not in frame:
                frame['filename'] = frame.pop('abs_path', None)

            # ensure we've got the correct required values
            assert frame.get('filename') or frame.get('function') or frame.get('module')

            # lineno should be an int
            if 'lineno' in frame:
                if frame['lineno'] is None:
                    del frame['lineno']
                else:
                    frame['lineno'] = int(frame['lineno'])

            # colno should be an int
            if 'colno' in frame:
                if frame['colno'] is None:
                    del frame['colno']
                else:
                    frame['colno'] = int(frame['colno'])

            # in_app should be a boolean
            if 'in_app' in frame:
                frame['in_app'] = bool(frame['in_app'])

            abs_path = frame.get('abs_path') or frame.get('filename')
            if abs_path and abs_path.startswith(('http:', 'https:')):
                urlparts = urlparse.urlparse(abs_path)
                if urlparts.path:
                    frame['abs_path'] = abs_path
                    frame['filename'] = urlparts.path

    def serialize(self):
        return {
            'frames': self.frames,
        }

    def get_composite_hash(self, interfaces):
        output = self.get_hash()
        if 'sentry.interfaces.Exception' in interfaces:
            output.append(interfaces['sentry.interfaces.Exception'].type)
        return output

    def get_hash(self):
        output = []
        for frame in self.frames:
            output.extend(self.get_frame_hash(frame))
        return output

    def get_frame_hash(self, frame):
        output = []
        if frame.get('module'):
            output.append(frame['module'])
        elif frame.get('filename'):
            output.append(frame['filename'])

        if frame.get('context_line'):
            output.append(frame['context_line'])
        elif frame.get('function'):
            output.append(frame['function'])
        elif frame.get('lineno'):
            output.append(frame['lineno'])
        return output

    def is_newest_frame_first(self, event):
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

    def to_html(self, event):
        if not self.frames:
            return ''

        system_frames = 0
        frames = []
        for frame in self.frames:
            if frame.get('context_line') and frame.get('lineno') is not None:
                context = get_context(
                    lineno=frame['lineno'],
                    context_line=frame['context_line'],
                    pre_context=frame.get('pre_context'),
                    post_context=frame.get('post_context'),
                    filename=frame.get('abs_path', frame.get('filename')),
                    format=True,
                )
                start_lineno = context[0][0]
            else:
                context = []
                start_lineno = None

            context_vars = []
            if frame.get('vars'):
                context_vars = frame['vars']
            else:
                context_vars = []

            if frame.get('lineno') is not None:
                lineno = int(frame['lineno'])
            else:
                lineno = None

            in_app = bool(frame.get('in_app', True))

            frame_data = {
                'abs_path': frame.get('abs_path'),
                'filename': frame.get('filename'),
                'function': frame.get('function'),
                'start_lineno': start_lineno,
                'lineno': lineno,
                'context': context,
                'vars': context_vars,
                'in_app': in_app,
            }

            if event.platform == 'javascript' and frame.get('data'):
                data = frame['data']
                frame_data.update({
                    'sourcemap': data['sourcemap'].rsplit('/', 1)[-1],
                    'orig_filename': data['orig_filename'],
                    'orig_lineno': data['orig_lineno'],
                    'orig_colno': data['orig_colno'],
                })

            frames.append(frame_data)

            if not in_app:
                system_frames += 1

        if len(frames) == system_frames:
            system_frames = 0

        newest_first = self.is_newest_frame_first(event)
        if newest_first:
            frames = frames[::-1]

        return render_to_string('sentry/partial/interfaces/stacktrace.html', {
            'newest_first': newest_first,
            'system_frames': system_frames,
            'event': event,
            'frames': frames,
            'stacktrace': self.get_traceback(event, newest_first=newest_first),
        })

    def to_string(self, event):
        return self.get_stacktrace(event, system_frames=False, max_frames=5)

    def get_stacktrace(self, event, system_frames=True, newest_first=None, max_frames=None):
        if newest_first is None:
            newest_first = self.is_newest_frame_first(event)

        result = []
        if newest_first:
            result.append(_('Stacktrace (most recent call first):'))
        else:
            result.append(_('Stacktrace (most recent call last):'))

        result.append('')

        frames = self.frames

        num_frames = len(frames)

        if not system_frames:
            frames = [f for f in frames if f.get('in_app') is not False]
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
            pieces = ['  File "%(filename)s"']
            if 'lineno' in frame:
                pieces.append(', line %(lineno)s')
            if 'function' in frame:
                pieces.append(', in %(function)s')

            result.append(''.join(pieces) % frame)
            if frame.get('context_line', None) is not None:
                result.append('    %s' % frame['context_line'].strip())

        if newest_first and visible_frames < num_frames:
            result.extend(('...', '(%d additional frame(s) were not displayed)' % (num_frames - visible_frames,)))

        return '\n'.join(result)

    def get_traceback(self, event, newest_first=None):
        result = [
            event.message, '',
            self.get_stacktrace(event, newest_first=newest_first),
        ]

        return '\n'.join(result)

    def get_search_context(self, event):
        return {
            'text': list(itertools.chain(*[[f.get('filename'), f.get('function'), f.get('context_line')] for f in self.frames])),
        }


class Exception(Interface):
    """
    A standard exception with a mandatory ``value`` argument, and optional
    ``type`` and``module`` argument describing the exception class type and
    module namespace.

    >>>  {
    >>>     "type": "ValueError",
    >>>     "value": "My exception value",
    >>>     "module": "__builtins__"
    >>> }
    """

    score = 900
    display_score = 1200

    def __init__(self, value, type=None, module=None):
        # A human readable value for the exception
        self.value = value
        # The exception type name (e.g. TypeError)
        self.type = type
        # Optional module of the exception type (e.g. __builtin__)
        self.module = module

    def serialize(self):
        return {
            'type': self.type,
            'value': self.value,
            'module': self.module,
        }

    def get_hash(self):
        return filter(bool, [self.type, self.value])

    def to_html(self, event):
        last_frame = None
        interface = event.interfaces.get('sentry.interfaces.Stacktrace')
        if interface is not None and interface.frames:
            last_frame = interface.frames[-1]
        return render_to_string('sentry/partial/interfaces/exception.html', {
            'event': event,
            'exception_value': self.value,
            'exception_type': self.type,
            'exception_module': self.module,
            'last_frame': last_frame
        })

    def get_search_context(self, event):
        return {
            'text': [self.value, self.type, self.module]
        }


class Http(Interface):
    """
    The Request information is stored in the Http interface. Two arguments
    are required: ``url`` and ``method``.

    The ``env`` variable is a compounded dictionary of HTTP headers as well
    as environment information passed from the webserver. Sentry will explicitly
    look for ``REMOTE_ADDR`` in ``env`` for things which require an IP address.

    The ``data`` variable should only contain the request body (not the query
    string). It can either be a dictionary (for standard HTTP requests) or a
    raw request body.

    >>>  {
    >>>     "url": "http://absolute.uri/foo",
    >>>     "method": "POST",
    >>>     "data": {
    >>>         "foo": "bar"
    >>>     },
    >>>     "query_string": "hello=world",
    >>>     "cookies": "foo=bar",
    >>>     "headers": {
    >>>         "Content-Type": "text/html"
    >>>     },
    >>>     "env": {
    >>>         "REMOTE_ADDR": "192.168.0.1"
    >>>     }
    >>>  }
    """

    display_score = 1000
    score = 800

    # methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html + PATCH
    METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT', 'PATCH')

    def __init__(self, url, method=None, data=None, query_string=None, cookies=None, headers=None, env=None, **kwargs):
        if data is None:
            data = {}

        if method:
            method = method.upper()

        urlparts = urlparse.urlsplit(url)

        if not query_string:
            # define querystring from url
            query_string = urlparts.query

        elif query_string.startswith('?'):
            # remove '?' prefix
            query_string = query_string[1:]

        self.url = '%s://%s%s' % (urlparts.scheme, urlparts.netloc, urlparts.path)
        self.method = method
        self.data = data
        self.query_string = query_string
        if cookies:
            self.cookies = cookies
        else:
            self.cookies = {}
        # if cookies were a string, convert to a dict
        # parse_qsl will parse both acceptable formats:
        #  a=b&c=d
        # and
        #  a=b; c=d
        if isinstance(self.cookies, basestring):
            self.cookies = dict(urlparse.parse_qsl(self.cookies, keep_blank_values=True))
        # if cookies were [also] included in headers we
        # strip them out
        if headers and 'Cookie' in headers:
            cookies = headers.pop('Cookie')
            if cookies:
                self.cookies = cookies
        self.headers = headers or {}
        self.env = env or {}

    def serialize(self):
        return {
            'url': self.url,
            'method': self.method,
            'data': self.data,
            'query_string': self.query_string,
            'cookies': self.cookies,
            'headers': self.headers,
            'env': self.env,
        }

    def to_string(self, event):
        return render_to_string('sentry/partial/interfaces/http.txt', {
            'event': event,
            'full_url': '?'.join(filter(bool, [self.url, self.query_string])),
            'url': self.url,
            'method': self.method,
            'query_string': self.query_string,
        })

    def _to_dict(self, value):
        if value is None:
            value = {}
        if isinstance(value, dict):
            return True, value
        try:
            value = QueryDict(value)
        except _Exception:
            return False, value
        else:
            return True, value

    def to_html(self, event):
        data = self.data
        data_is_dict = False
        headers_is_dict, headers = self._to_dict(self.headers)

        if headers_is_dict and headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            data_is_dict, data = self._to_dict(data)

        # It's kind of silly we store this twice
        cookies_is_dict, cookies = self._to_dict(self.cookies or headers.pop('Cookie', {}))

        return render_to_string('sentry/partial/interfaces/http.html', {
            'event': event,
            'full_url': '?'.join(filter(bool, [self.url, self.query_string])),
            'url': self.url,
            'method': self.method,
            'data': data,
            'data_is_dict': data_is_dict,
            'query_string': self.query_string,
            'cookies': cookies,
            'cookies_is_dict': cookies_is_dict,
            'headers': self.headers,
            'headers_is_dict': headers_is_dict,
            'env': self.env,
        })

    def get_title(self):
        return _('Request')

    def get_search_context(self, event):
        return {
            'filters': {
                'url': [self.url],
            }
        }


class Template(Interface):
    """
    A rendered template (generally used like a single frame in a stacktrace).

    The attributes ``filename``, ``context_line``, and ``lineno`` are required.

    >>>  {
    >>>     "abs_path": "/real/file/name.html"
    >>>     "filename": "file/name.html",
    >>>     "pre_context": [
    >>>         "line1",
    >>>         "line2"
    >>>     ],
    >>>     "context_line": "line3",
    >>>     "lineno": 3,
    >>>     "post_context": [
    >>>         "line4",
    >>>         "line5"
    >>>     ],
    >>> }
    """

    score = 1100

    def __init__(self, filename, context_line, lineno, pre_context=None, post_context=None,
                 abs_path=None):
        self.abs_path = abs_path
        self.filename = filename
        self.context_line = context_line
        self.lineno = int(lineno)
        self.pre_context = pre_context
        self.post_context = post_context

    def serialize(self):
        return {
            'abs_path': self.abs_path,
            'filename': self.filename,
            'context_line': self.context_line,
            'lineno': self.lineno,
            'pre_context': self.pre_context,
            'post_context': self.post_context,
        }

    def get_hash(self):
        return [self.filename, self.context_line]

    def to_string(self, event):
        context = get_context(
            lineno=self.lineno,
            context_line=self.context_line,
            pre_context=self.pre_context,
            post_context=self.post_context,
            filename=self.filename,
            format=False,
        )

        result = [
            'Stacktrace (most recent call last):', '',
            self.get_traceback(event, context)
        ]

        return '\n'.join(result)

    def to_html(self, event):
        context = get_context(
            lineno=self.lineno,
            context_line=self.context_line,
            pre_context=self.pre_context,
            post_context=self.post_context,
            filename=self.filename,
            format=True,
        )

        return render_to_string('sentry/partial/interfaces/template.html', {
            'event': event,
            'abs_path': self.abs_path,
            'filename': self.filename,
            'lineno': int(self.lineno),
            'start_lineno': context[0][0],
            'context': context,
            'template': self.get_traceback(event, context),
        })

    def get_traceback(self, event, context):
        result = [
            event.message, '',
            'File "%s", line %s' % (self.filename, self.lineno), '',
        ]
        result.extend([n[1].strip('\n') for n in context])

        return '\n'.join(result)

    def get_search_context(self, event):
        return {
            'text': [self.abs_path, self.filename, self.context_line],
        }


class User(Interface):
    """
    An interface which describes the authenticated User for a request.

    All data is arbitrary and optional other than the ``id``
    field which should be a string representing the user's unique identifier.

    >>> {
    >>>     "id": "unique_id",
    >>>     "username": "my_user",
    >>>     "email": "foo@example.com"
    >>> }
    """

    def __init__(self, id=None, email=None, username=None, **kwargs):
        self.id = id
        self.email = email
        self.username = username
        self.data = kwargs

    def serialize(self):
        # XXX: legacy -- delete
        if hasattr(self, 'is_authenticated'):
            self.data['is_authenticated'] = self.is_authenticated

        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'data': self.data,
        }

    def get_hash(self):
        return []

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/user.html', {
            'event': event,
            'user_id': self.id,
            'user_username': self.username,
            'user_email': self.email,
            'user_data': self.data,
        })

    def get_search_context(self, event):
        tokens = filter(bool, [self.id, self.username, self.email])
        if not tokens:
            return {}

        return {
            'text': tokens
        }
