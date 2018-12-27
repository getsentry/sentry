from __future__ import absolute_import

__all__ = ('Device', )

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.utils.safe import trim, trim_dict


class Device(Interface):
    """
    An interface which describes the device.

    >>> {
    >>>     "name": "Windows",
    >>>     "version": "95",
    >>>     "build": "95.0.134.1651",
    >>>     "arbitrary": "data"
    >>> }
    """
    path = 'device'

    @classmethod
    def to_python(cls, data):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid device")

        data = data.copy()

        extra_data = data.pop('data', data)
        name = trim(data.pop('name'), 64)
        version = trim(data.pop('version'), 64)
        build = trim(data.pop('build', None), 64)

        kwargs = {
            'name': name,
            'version': version,
            'build': build,
            'data': trim_dict(extra_data),
        }
        return cls(**kwargs)

    def get_api_context(self, is_public=False):
        return {
            'name': self.name,
            'version': self.version,
            'build': self.build,
            'data': self.data,
        }

    def get_path(self):
        return 'device'

    def get_hash(self):
        return []
