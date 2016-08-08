"""
sentry.interfaces.message
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Message',)

import six

from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils import json
from sentry.utils.safe import trim


class Message(Interface):
    """
    A standard message consisting of a ``message`` arg, an an optional
    ``params`` arg for formatting, and an optional ``formatted`` message which
    is the result of ``message`` combined with ``params``.

    If your message cannot be parameterized, then the message interface
    will serve no benefit.

    - ``message`` must be no more than 1000 characters in length.

    >>> {
    >>>     "message": "My raw message with interpreted strings like %s",
    >>>     "formatted": "My raw message with interpreted strings like this",
    >>>     "params": ["this"]
    >>> }
    """
    score = 0
    display_score = 2050

    @classmethod
    def to_python(cls, data):
        if not data.get('message'):
            raise InterfaceValidationError("No 'message' present")

        # TODO(dcramer): some day we should stop people from sending arbitrary
        # crap to the server
        if not isinstance(data['message'], six.string_types):
            data['message'] = json.dumps(data['message'])

        kwargs = {
            'message': trim(data['message'], settings.SENTRY_MAX_MESSAGE_LENGTH),
            'formatted': data.get('formatted'),
        }

        if data.get('params'):
            kwargs['params'] = trim(data['params'], 1024)
        else:
            kwargs['params'] = ()

        if kwargs['formatted']:
            if not isinstance(kwargs['formatted'], six.string_types):
                data['formatted'] = json.dumps(data['formatted'])
        # support python-esque formatting (e.g. %s)
        elif '%' in kwargs['message'] and kwargs['params']:
            if isinstance(kwargs['params'], list):
                kwargs['params'] = tuple(kwargs['params'])

            try:
                kwargs['formatted'] = trim(
                    kwargs['message'] % kwargs['params'],
                    settings.SENTRY_MAX_MESSAGE_LENGTH,
                )
            except Exception:
                pass
        # support very basic placeholder formatters (non-typed)
        elif '{}' in kwargs['message'] and kwargs['params']:
            try:
                kwargs['formatted'] = trim(
                    kwargs['message'].format(kwargs['params']),
                    settings.SENTRY_MAX_MESSAGE_LENGTH,
                )
            except Exception:
                pass

        # don't wastefully store formatted message twice
        if kwargs['formatted'] == kwargs['message']:
            kwargs['formatted'] = None

        return cls(**kwargs)

    def get_path(self):
        return 'sentry.interfaces.Message'

    def get_hash(self):
        return [self.message]

    def to_string(self, event, is_public=False, **kwargs):
        return self.formatted or self.message
