"""
sentry.interfaces.template
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('Template',)

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import get_context
from sentry.utils.safe import trim


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

    .. note:: This interface can be passed as the 'template' key in addition
              to the full interface path.
    """
    score = 1100

    @classmethod
    def to_python(cls, data):
        assert data.get('filename')
        assert data.get('context_line')
        assert data.get('lineno')

        kwargs = {
            'abs_path': trim(data.get('abs_path', None), 256),
            'filename': trim(data['filename'], 256),
            'context_line': trim(data.get('context_line', None), 256),
            'lineno': int(data['lineno']),
            # TODO(dcramer): trim pre/post_context
            'pre_context': data.get('pre_context'),
            'post_context': data.get('post_context'),
        }
        return cls(**kwargs)

    def get_alias(self):
        return 'template'

    def get_path(self):
        return 'sentry.interfaces.Template'

    def get_hash(self):
        return [self.filename, self.context_line]

    def to_string(self, event, is_public=False, **kwargs):
        context = get_context(
            lineno=self.lineno,
            context_line=self.context_line,
            pre_context=self.pre_context,
            post_context=self.post_context,
            filename=self.filename,
        )

        result = [
            'Stacktrace (most recent call last):', '',
            self.get_traceback(event, context)
        ]

        return '\n'.join(result)

    def get_traceback(self, event, context):
        result = [
            event.message, '',
            'File "%s", line %s' % (self.filename, self.lineno), '',
        ]
        result.extend([n[1].strip('\n') for n in context])

        return '\n'.join(result)

    def get_api_context(self, is_public=False):
        return {
            'lineNo': self.lineno,
            'filename': self.filename,
            'context': get_context(
                lineno=self.lineno,
                context_line=self.context_line,
                pre_context=self.pre_context,
                post_context=self.post_context,
                filename=self.filename,
            ),
        }
