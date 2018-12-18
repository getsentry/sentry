"""
sentry.interfaces.message
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Message', )

import six

from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys
from sentry.utils.safe import trim


class Message(Interface):
    """
    A message consisting of either a ``formatted`` arg, or an optional
    ``message`` with a list of ``params``.

    - ``message`` and ``formatted`` are limited to 1000 characters.

    >>> {
    >>>     "message": "My raw message with interpreted strings like %s",
    >>>     "formatted": "My raw message with interpreted strings like this",
    >>>     "params": ["this"]
    >>> }
    """
    score = 0
    display_score = 2050
    path = 'logentry'
    external_type = 'message'

    @classmethod
    def to_python(cls, data):
        formatted = data.get('formatted')
        if not isinstance(formatted, six.string_types):
            formatted = None

        message = data.get('message')
        if not isinstance(message, six.string_types):
            message = None

        if not formatted and not message:
            raise InterfaceValidationError("No message present")

        params = data.get('params')
        if isinstance(params, list):
            params = tuple(params)
        elif not isinstance(params, tuple):
            params = ()

        if not formatted and params and '%' in message:
            try:
                formatted = message % params
            except Exception:
                pass

        if not formatted or message == formatted:
            formatted = message
            message = None

        return cls(
            formatted=trim(formatted, settings.SENTRY_MAX_MESSAGE_LENGTH),
            message=trim(message, settings.SENTRY_MAX_MESSAGE_LENGTH),
            params=trim(params, 1024),
        )

    def to_json(self):
        return prune_empty_keys({
            'message': self.message,
            'formatted': self.formatted,
            'params': self.params or None
        })

    def get_hash(self):
        return [self.message or self.formatted]

    def to_string(self, event, is_public=False, **kwargs):
        return self.formatted or self.message
