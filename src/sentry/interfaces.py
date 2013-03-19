"""
sentry.interfaces
~~~~~~~~~~~~~~~~~

Interfaces provide an abstraction for how structured data should be
validated and rendered.

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import itertools
import urlparse
import warnings

from pygments import highlight
# from pygments.lexers import get_lexer_for_filename, TextLexer, ClassNotFound
from pygments.lexers import TextLexer
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


def is_url(filename):
    return filename.startswith(('http:', 'https:', 'file:'))


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

    if format:
        # try:
        #     lexer = get_lexer_for_filename(filename)
        # except ClassNotFound:
        #     lexer = TextLexer()
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
    An interface is a structured representation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    score = 0
    display_score = None

    def __init__(self, **kwargs):
        self.attrs = kwargs.keys()
        self.__dict__.update(kwargs)

    def __eq__(self, other):
        if type(self) != type(other):
            return False
        return self.serialize() == other.serialize()

    def __setstate__(self, data):
        kwargs = self.unserialize(data)
        self.attrs = kwargs.keys()
        self.__dict__.update(kwargs)

    def __getstate__(self):
        return self.serialize()

    def validate(self):
        pass

    def unserialize(self, data):
        return data

    def serialize(self):
        return dict((k, self.__dict__[k]) for k in self.attrs)

    def get_composite_hash(self, interfaces):
        return self.get_hash()

    def get_hash(self):
        return []

    def to_html(self, event, is_public=False, **kwargs):
        return ''

    def to_string(self, event, is_public=False, **kwargs):
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
    attrs = ('message', 'params')

    def __init__(self, message, params=()):
        self.message = message
        self.params = params

    def validate(self):
        assert len(self.message) <= 5000

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
    attrs = ('query', 'engine')

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


class Frame(object):
    attrs = ('abs_path', 'filename', 'lineno', 'colno', 'in_app', 'context_line',
             'pre_context', 'post_context', 'vars', 'module', 'function', 'data')

    def __init__(self, abs_path=None, filename=None, lineno=None, colno=None, in_app=False,
                 context_line=None, pre_context=(), post_context=(), vars=None,
                 module=None, function=None, data=None):
        self.abs_path = abs_path or filename
        self.filename = filename or abs_path

        if self.is_url():
            urlparts = urlparse.urlparse(self.abs_path)
            if urlparts.path:
                self.filename = urlparts.path

        self.module = module
        self.function = function

        if lineno is not None:
            self.lineno = int(lineno)
        else:
            self.lineno = None
        if colno is not None:
            self.colno = int(colno)
        else:
            self.colno = None

        self.in_app = in_app
        self.context_line = context_line
        self.pre_context = pre_context
        self.post_context = post_context
        self.vars = vars or {}
        self.data = data or {}

    def __getitem__(self, key):
        warnings.warn('Frame[key] is deprecated. Use Frame.key instead.', DeprecationWarning)
        return getattr(self, key)

    def is_url(self):
        if not self.abs_path:
            return False
        return is_url(self.abs_path)

    def is_valid(self):
        if self.in_app not in (False, True, None):
            return False
        return self.filename or self.function or self.module

    def get_hash(self):
        output = []
        if self.module:
            output.append(self.module)
        elif self.filename and not self.is_url():
            output.append(self.filename)

        if self.context_line is not None:
            output.append(self.context_line)
        elif self.function:
            output.append(self.function)
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
                format=True,
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
                'sourcemap_url': urlparse.urljoin(self.abs_path, self.data['sourcemap']),
                'orig_function': self.data['orig_function'],
                'orig_filename': self.data['orig_filename'],
                'orig_lineno': self.data['orig_lineno'],
                'orig_colno': self.data['orig_colno'],
            })
        return frame_data

    def to_string(self, event):
        if event.platform is not None:
            choices = [event.platform]
        else:
            choices = []
        choices.append('default')
        templates = ['sentry/partial/frames/%s.txt' % choice
                      for choice in choices]
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
    attrs = ('frames',)
    score = 1000

    def __init__(self, frames):
        self.frames = [Frame(**f) for f in frames]

    def validate(self):
        for frame in self.frames:
            # ensure we've got the correct required values
            assert frame.is_valid()

    def serialize(self):
        frames = []
        for f in self.frames:
            # compatibility with old serialization
            if isinstance(f, Frame):
                frames.append(vars(f))
            else:
                frames.append(f)

        return {
            'frames': frames,
        }

    def unserialize(self, data):
        data['frames'] = [Frame(**f) for f in data.pop('frames', [])]
        return data

    def get_composite_hash(self, interfaces):
        output = self.get_hash()
        if 'sentry.interfaces.Exception' in interfaces:
            exc = interfaces['sentry.interfaces.Exception']
            if exc.type:
                output.append(exc.type)
            elif not output:
                output.append(exc.value)
        return output

    def get_hash(self):
        output = []
        for frame in self.frames:
            output.extend(frame.get_hash())
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

    def to_html(self, event, is_public=False, **kwargs):
        if not self.frames:
            return ''

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

        newest_first = self.is_newest_frame_first(event)
        if newest_first:
            frames = frames[::-1]

        return render_to_string('sentry/partial/interfaces/stacktrace.html', {
            'is_public': is_public,
            'newest_first': newest_first,
            'system_frames': system_frames,
            'event': event,
            'frames': frames,
            'stacktrace': self.get_traceback(event, newest_first=newest_first),
        })

    def to_string(self, event, is_public=False, **kwargs):
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

    def get_search_context(self, event):
        return {
            'text': list(itertools.chain(*[[f.filename, f.function, f.context_line] for f in self.frames])),
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
    attrs = ('value', 'type', 'module')

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

    def to_html(self, event, is_public=False, **kwargs):
        last_frame = None
        interface = event.interfaces.get('sentry.interfaces.Stacktrace')
        if interface is not None and interface.frames:
            last_frame = interface.frames[-1]
        return render_to_string('sentry/partial/interfaces/exception.html', {
            'is_public': is_public,
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
    attrs = ('url', 'method', 'data', 'query_string', 'cookies', 'headers',
             'env')

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

    def to_string(self, event, is_public=False, **kwargs):
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

    def to_html(self, event, is_public=False, **kwargs):
        data = self.data
        headers_is_dict, headers = self._to_dict(self.headers)

        if headers_is_dict and headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            _, data = self._to_dict(data)

        context = {
            'is_public': is_public,
            'event': event,
            'full_url': '?'.join(filter(bool, [self.url, self.query_string])),
            'url': self.url,
            'method': self.method,
            'data': data,
            'query_string': self.query_string,
            'headers': self.headers,
        }
        if not is_public:
            # It's kind of silly we store this twice
            _, cookies = self._to_dict(self.cookies)

            context.update({
                'cookies': cookies,
                'env': self.env,
            })

        return render_to_string('sentry/partial/interfaces/http.html', context)

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
    attrs = ('filename', 'context_line', 'lineno', 'pre_context', 'post_context',
             'abs_path')
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

    def to_string(self, event, is_public=False, **kwargs):
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

    def to_html(self, event, is_public=False, **kwargs):
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
            'is_public': is_public,
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
    attrs = ('id', 'email', 'username', 'data')

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

    def to_html(self, event, is_public=False, **kwargs):
        return render_to_string('sentry/partial/interfaces/user.html', {
            'is_public': is_public,
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
