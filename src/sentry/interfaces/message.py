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

from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys, RUST_RENORMALIZED_DEFAULT
from sentry.utils import json
from sentry.utils.safe import trim


def stringify(value):
    if isinstance(value, six.string_types):
        return value

    if isinstance(value, (int, float, bool)):
        return json.dumps(value)

    return None


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
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if rust_renormalized:
            for key in (
                'message',
                'formatted',
                'params',
            ):
                data.setdefault(key, None)
            return cls(**data)

        formatted = stringify(data.get('formatted'))
        message = stringify(data.get('message'))
        if formatted is None and message is None:
            raise InterfaceValidationError("No message present")

        params = data.get('params')
        if isinstance(params, (list, tuple)):
            params = tuple(p for p in params)
        elif isinstance(params, dict):
            params = {k: v for k, v in six.iteritems(params)}
        else:
            params = ()

        if formatted is None and params:
            try:
                if '%' in message:
                    formatted = message % params
                elif '{}' in message and isinstance(params, tuple):
                    formatted = message.format(*params)
                # NB: Named newstyle arguments were never supported
            except Exception:
                pass

        if formatted is None or message == formatted:
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

    def to_string(self, event, is_public=False, **kwargs):
        return self.formatted or self.message
