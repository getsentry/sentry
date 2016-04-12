from __future__ import absolute_import

__all__ = ('Sdk',)

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim


class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry-unity",
    >>>     "version": "1.0"
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        name = data.get('name')
        if not name:
            raise InterfaceValidationError("No 'name' value")

        version = data.get('version')
        if not version:
            raise InterfaceValidationError("No 'version' value")

        kwargs = {
            'name': trim(name, 128),
            'version': trim(version, 128),
        }
        return cls(**kwargs)

    def get_path(self):
        return 'sdk'
