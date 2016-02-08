"""
sentry.interfaces.applecrash
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('AppleCrashReport',)

from sentry.interfaces.base import Interface, InterfaceValidationError


class AppleCrashReport(Interface):
    """
    An apple crash report in JSON format.  This typically gets converted
    into other interfaces as part of the processing.

    >>> {
    >>>     "crash": {...}
    >>> }
    """

    ephemeral = True

    @classmethod
    def to_python(cls, data):
        if not data.get('message'):
            raise InterfaceValidationError("No 'message' present")

        kwargs = {
            'crash': data['crash'],
            'binary_images': data['binary_images'],
        }

        return cls(**kwargs)

    def get_path(self):
        return 'sentry.interfaces.AppleCrashReport'
