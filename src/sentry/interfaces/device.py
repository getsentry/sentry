from __future__ import absolute_import

__all__ = ('Device',)

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim, trim_dict


class Device(Interface):
    """
    An interface which describes the device.

    >>> {
    >>>     "model": "iPad7,1",
    >>>     "model_id": "N102AP",
    >>>     "os": "iOS",
    >>>     "os_version": "9.3.2",
    >>>     "os_build": "13F69",
    >>>     "arch": "arm64"
    >>> }

    For computers:

    >>> {
    >>>     "model": "MacBookPro12,1",
    >>>     "os": "macOS",
    >>>     "os_version": "10.11.5",
    >>>     "os_build": "15F34",
    >>>     "arch": "x86_64"
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        extra_data = data.get('data')
        if not isinstance(extra_data, dict):
            extra_data = {}

        model = trim(data.get('model'), 64)
        os = trim(data.get('os'), 64)
        if not (model or os):
            raise InterfaceValidationError("One of 'model' or 'os' is required.")

        kwargs = {
            'model': model,
            'model_id': trim(data.get('model_id'), 40),
            'os': os,
            'os_version': trim(data.get('os_version'), 40),
            'os_build': trim(data.get('os_version'), 40),
            'arch': trim(data.get('arch'), 40),
            'data': trim_dict(extra_data),
        }
        return cls(**kwargs)

    def get_api_context(self, is_public=False):
        return {
            'model': self.model,
            'model_id': self.model_id,
            'os': self.os,
            'os_version': self.os_version,
            'os_build': self.os_build,
            'arch': self.arch,
            'data': self.data,
        }

    def get_path(self):
        return 'device'

    def get_hash(self):
        return []
