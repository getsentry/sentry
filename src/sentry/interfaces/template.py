"""
sentry.interfaces.template
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

__all__ = ('Template', )

from sentry.interfaces.base import Interface, InterfaceValidationError, RUST_RENORMALIZED_DEFAULT
from sentry.interfaces.schemas import validate_and_default_interface
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
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if rust_renormalized:
            for key in (
                'abs_path',
                'filename',
                'context_line',
                'lineno',
                'pre_context',
                'post_context',
            ):
                data.setdefault(key, None)
            return cls(**data)

        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid template")

        kwargs = {
            'abs_path': trim(data.get('abs_path', None), 256),
            'filename': trim(data.get('filename', None), 256),
            'context_line': trim(data.get('context_line', None), 256),
            'lineno': int(data['lineno']) if data.get('lineno', None) is not None else None,
            # TODO(dcramer): trim pre/post_context
            'pre_context': data.get('pre_context'),
            'post_context': data.get('post_context'),
        }
        return cls(**kwargs)

    def to_string(self, event, is_public=False, **kwargs):
        context = get_context(
            lineno=self.lineno,
            context_line=self.context_line,
            pre_context=self.pre_context,
            post_context=self.post_context,
        )

        result = ['Stacktrace (most recent call last):', '', self.get_traceback(event, context)]

        return '\n'.join(result)

    def get_traceback(self, event, context):
        result = [
            event.real_message,
            '',
            'File "%s", line %s' % (self.filename, self.lineno),
            '',
        ]
        result.extend([n[1].strip('\n') if n[1] else '' for n in context])

        return '\n'.join(result)

    def get_api_context(self, is_public=False, platform=None):
        return {
            'lineNo': self.lineno,
            'filename': self.filename,
            'context': get_context(
                lineno=self.lineno,
                context_line=self.context_line,
                pre_context=self.pre_context,
                post_context=self.post_context,
            ),
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {
            '': meta.get(''),
            'lineNo': meta.get('lineno'),
            'filename': meta.get('filename'),
            'context': get_context(
                lineno=meta.get('lineno'),
                context_line=meta.get('context_line'),
                pre_context=meta.get('pre_context'),
                post_context=meta.get('post_context'),
            ),
        }
