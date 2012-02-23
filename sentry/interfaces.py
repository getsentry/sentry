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

from django.http import QueryDict

from sentry.web.helpers import render_to_string


# unserialization concept is based on pickle
class _EmptyClass(object):
    pass


def unserialize(klass, data):
    value = _EmptyClass()
    value.__class__ = klass
    value.__setstate__(data)
    return value


def get_context(lineno, context_line, pre_context=None, post_context=None):
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

    return context


class Interface(object):
    """
    An interface is a structured represntation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    score = 0

    def __init__(self, **kwargs):
        self.attrs = kwargs.keys()
        self.__dict__.update(kwargs)

    def __setstate__(self, data):
        self.__dict__.update(self.unserialize(data))

    def __getstate__(self):
        return self.serialize()

    def unserialize(self, data):
        return data

    def serialize(self):
        return dict((k, self.__dict__[k]) for k in self.attrs)

    def get_hash(self):
        return []

    def to_html(self, event):
        return ''

    def to_string(self, event):
        return ''

    def get_title(self):
        return self.__class__.__name__

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
    def __init__(self, message, params=()):
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
            params = ()
        return {
            'text': [self.message] + params,
        }


class Query(Interface):
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
    score = 1000

    def __init__(self, frames):
        self.frames = frames
        for frame in frames:
            # ensure we've got the correct required values
            assert 'filename' in frame
            assert 'lineno' in frame
            # assert 'context_line' in frame
            # assert 'function' in frame

    def _shorten(self, value, depth=1):
        if depth > 5:
            return type(value)
        if isinstance(value, dict):
            return dict((k, self._shorten(v, depth + 1)) for k, v in sorted(value.iteritems())[:100 / depth])
        elif isinstance(value, (list, tuple, set, frozenset)):
            return tuple(self._shorten(v, depth + 1) for v in value)[:100 / depth]
        elif isinstance(value, (int, long, float)):
            return value
        elif not value:
            return value
        return value[:100]

    def serialize(self):
        return {
            'frames': self.frames,
        }

    def get_hash(self):
        output = []
        for frame in self.frames:
            output.append(frame['module'])
            output.append(frame['function'])
        return output

    def to_html(self, event):
        frames = []
        for frame in self.frames:
            if 'context_line' in frame:
                context = get_context(frame['lineno'], frame['context_line'], frame.get('pre_context'), frame.get('post_context'))
                start_lineno = context[0][0]
            else:
                context = []
                start_lineno = None

            context_vars = []
            if 'vars' in frame:
                context_vars = self._shorten(frame['vars'])
            else:
                context_vars = []

            frames.append({
                'abs_path': frame.get('abs_path'),
                'filename': frame['filename'],
                'function': frame.get('function'),
                'start_lineno': start_lineno,
                'lineno': frame.get('lineno'),
                'context': context,
                'vars': context_vars,
            })

        return render_to_string('sentry/partial/interfaces/stacktrace.html', {
            'event': event,
            'frames': frames,
            'stacktrace': self.get_traceback(event),
        })

    def to_string(self, event):
        r = ['Stacktrace (most recent call last):']
        for f in self.frames:
            r.append('  File "%(filename)s", line %(lineno)s, in %(function)s\n    %(context_line)s' % f)
        return '\n'.join(r)

    def get_traceback(self, event):
        result = [
            event.message, '',
            'Traceback (most recent call last):', '',
        ]
        for frame in self.frames:
            if 'function' in frame:
                result.append('  File "%(filename)s", line %(lineno)s, in %(function)s' % frame)
            else:
                result.append('  File "%(filename)s", line %(lineno)s' % frame)
            if 'context_line' in frame:
                result.append('    %s' % frame['context_line'].strip())
            result.append('')

        return '\n'.join(result)

    def get_search_context(self, event):
        return {
            'text': list(itertools.chain(*[[f.get('filename'), f.get('function'), f.get('context_line')] for f in self.frames])),
        }


class Exception(Interface):
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
        output = filter(bool, [self.module, self.type])
        if not output:
            output = [self.value]
        return output

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/exception.html', {
            'event': event,
            'exception_value': self.value,
            'exception_type': self.type,
            'exception_module': self.module,
        })

    def get_search_context(self, event):
        return {
            'text': [self.value, self.type, self.module]
        }


class Http(Interface):
    score = 100

    # methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
    METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT')

    def __init__(self, url, method=None, data=None, query_string=None, cookies=None, headers=None, env=None, **kwargs):
        if data is None:
            data = {}

        if method:
            method = method.upper()

            assert method in self.METHODS

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
        # if cookies were [also] included in headers we
        # strip them out
        if headers and 'Cookie' in headers:
            cookies = headers.pop('Cookie')
            if not self.cookies:
                cookies = self.cookies
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

    def to_html(self, event):
        data = self.data
        data_is_dict = False
        if self.headers.get('Content-Type') == 'application/x-www-form-urlencoded':
            try:
                data = QueryDict(data)
            except:
                pass
            else:
                data_is_dict = True

        # It's kind of silly we store this twice
        cookies = self.cookies or self.headers.pop('Cookie', {})
        cookies_is_dict = isinstance(cookies, dict)
        if not cookies_is_dict:
            try:
                cookies = QueryDict(cookies)
            except:
                pass
            else:
                cookies_is_dict = True

        return render_to_string('sentry/partial/interfaces/http.html', {
            'event': event,
            'full_url': '?'.join(filter(None, [self.url, self.query_string])),
            'url': self.url,
            'method': self.method,
            'data': data,
            'data_is_dict': data_is_dict,
            'query_string': self.query_string,
            'cookies': cookies,
            'cookies_is_dict': cookies_is_dict,
            'headers': self.headers,
            'env': self.env,
        })

    def get_search_context(self, event):
        return {
            'filters': {
                'url': [self.url],
            }
        }


class Template(Interface):
    score = 1001

    def __init__(self, filename, context_line, lineno, pre_context=None, post_context=None,
                 abs_path=None):
        self.abs_path = abs_path
        self.filename = filename
        self.context_line = context_line
        self.lineno = lineno
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

    def to_html(self, event):
        context = get_context(self.lineno, self.context_line, self.pre_context, self.post_context)

        return render_to_string('sentry/partial/interfaces/template.html', {
            'event': event,
            'abs_path': self.abs_path,
            'filename': self.filename,
            'lineno': self.lineno,
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
    pass
