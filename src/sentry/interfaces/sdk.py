from __future__ import absolute_import

__all__ = ('Sdk',)

from distutils.version import LooseVersion
from django.conf import settings

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
            'client_ip': data.get('client_ip'),
        }
        return cls(**kwargs)

    def get_path(self):
        return 'sdk'

    def get_api_context(self):
        newest_version = settings.SDK_VERSIONS.get(self.name)
        newest_name = settings.DEPRECATED_SDKS.get(self.name, self.name)
        if newest_version is not None:
            try:
                is_newer = (
                    newest_name != self.name or
                    LooseVersion(newest_version) > LooseVersion(self.version)
                )
            except ValueError:
                is_newer = False
        else:
            is_newer = newest_name != self.name

        return {
            'name': self.name,
            'version': self.version,
            'clientIP': self.client_ip,
            'upstream': {
                'name': newest_name,
                # when this is correct we can make it available
                # 'version': newest_version,
                'isNewer': is_newer,
                'url': settings.SDK_URLS.get(newest_name),
            },
        }
