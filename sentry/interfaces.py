"""
sentry.interfaces
~~~~~~~~~~~~~~~~~

Interfaces provide an abstraction for how structured data should be
validated and rendered.

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import urlparse

from sentry.web.helpers import render_to_string

# unserialization concept is based on pickle
class _EmptyClass(object):
    pass

def unserialize(klass, data):
    value = _EmptyClass()
    value.__class__ = klass
    value.__setstate__(data)
    return value

class Interface(object):
    """
    An interface is a structured represntation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

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

    def to_html(self, event):
        return ''

    def to_string(self, event):
        return ''

class Message(Interface):
    def __init__(self, message, params):
        self.message = message
        self.params = params

    def serialize(self):
        return {
            'message': self.message,
            'params': self.params,
        }

class Query(Interface):
    def __init__(self, query, engine):
        self.query = query
        self.engine = engine

    def serialize(self):
        return {
            'query': self.query,
            'engine': self.engine,
        }

class Stacktrace(Interface):
    """
    {
        frames: {
            filename: '/real/file/name.py',
            function: 'myfunction',
            vars: {
                key: value
            },
            pre_context: [
                'line1',
                'line2'
            ],
            context_line: 'line3',
            lineno: 7,
            post_context: [
                'line4',
                'line5'
            ],
        }
    }
    """
    def __init__(self, frames):
        self.frames = frames

    def serialize(self):
        return {
            'frames': self.frames,
        }

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/stacktrace.html', {
            'frames': self.frames,
        })

    def to_string(self, event):
        r = ['Stacktrace (most recent call last):']
        for f in self.frames:
            r.append('  File "%(filename)s", line %(lineno)s, in %(function)s\n    %(context_line)s' % f)
        return '\n'.join(r)

    # TODO: abstract this  to some kind of "raw" hook for rendering
    def get_traceback(self, event):
        result = ['Traceback (most recent call last):', '']
        for frame in self.frames:
            result.append('  File "%(filename)s", line %(lineno)s, in %(function)s' % frame)
            result.append('    %s' % frame['context_line'].strip())
            result.append('')

        return '\n'.join(result)

class Exception(Interface):
    def __init__(self, type, value):
        self.type = type
        self.value = value

    def serialize(self):
        return {
            'type': self.type,
            'value': self.value,
        }

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/exception.html', {
            'exception_value': self.value,
            'exception_type': self.type,
        })

class Http(Interface):
    """
    {
        url: 'http://absolute.uri/foo',
        method: 'GET',
        data: {foo: 'bar'},
        query_string: 'hello=world&foo=bar',
        cookies: 'foo=bar',
        env: {REMOTE_ADDR: '192.168.0.1'}
    }
    """
        # methods as defined by http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
    METHODS = ('GET', 'POST', 'PUT', 'OPTIONS', 'HEAD', 'DELETE', 'TRACE', 'CONNECT')

    def __init__(self, url, method, data=None, query_string=None, cookies=None, env=None, **kwargs):
        if data is None:
            data = {}

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
        self.env = env or {}
        self.cookies = cookies or {}

    def serialize(self):
        return {
            'url': self.url,
            'method': self.method,
            'data': self.data,
            'query_string': self.query_string,
            'cookies': self.cookies,
            'env': self.env,
        }

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/http.html', {
            'full_url': '?'.join(filter(None, [self.url, self.query_string])),
            'url': self.url,
            'method': self.method,
            'data': self.data,
            'query_string': self.query_string,
            'cookies': self.cookies,
            'env': self.env,
        })

class Template(Interface):
    """
    {
        filename: '/real/file/name.html',
        pre_context: [
            'line1',
            'line2'
        ],
        context_line: 'line3',
        lineno: 7,
        post_context: [
            'line4',
            'line5'
        ],
    }
    """
    def __init__(self, filename, context_line, lineno, pre_context=None, post_context=None):
        self.filename = filename
        self.context_line = context_line
        self.lineno = lineno
        self.pre_context = pre_context
        self.post_context = post_context

    def serialize(self):
        return {
            'filename': self.filename,
            'context_line': self.context_line,
            'lineno': self.lineno,
            'pre_context': self.pre_context,
            'post_context': self.post_context,
        }

    def to_html(self, event):
        return render_to_string('sentry/partial/interfaces/template.html', {
            'filename': self.filename,
            'context_line': self.context_line,
            'lineno': self.lineno,
            'pre_context': self.pre_context,
            'pre_context_lineno': self.lineno - len(self.pre_context),
            'post_context': self.post_context,
        })

class User(Interface):
    """
    {
        is_authenticated: true,
        id: 'unique_id',
        username: 'foo',
        email: 'foo@example.com'
    }
    """