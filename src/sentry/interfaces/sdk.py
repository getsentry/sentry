from __future__ import absolute_import

__all__ = ('Sdk', )

from distutils.version import LooseVersion
from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim


def get_with_prefix(d, k, default=None, delimiter=":"):
    """\
    Retrieve a value from the dictionary, falling back to using its
    prefix, denoted by a delimiter (default ':'). Useful for cases
    such as looking up `raven-java:logback` in a dict like
    {"raven-java": "7.0.0"}.
    """

    prefix = k.split(delimiter, 1)[0]
    for key in [k, prefix]:
        if key in d:
            return d[key]

        key = key.lower()
        if key in d:
            return d[key]

    return default


class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry-java",
    >>>     "version": "1.0",
    >>>     "integrations": ["log4j"]
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

        integrations = data.get('integrations')
        if integrations and not isinstance(integrations, list):
            raise InterfaceValidationError("'integrations' must be a list")

        kwargs = {
            'name': trim(name, 128),
            'version': trim(version, 128),
            'client_ip': data.get('client_ip'),
            'integrations': integrations,
        }
        return cls(**kwargs)

    def get_path(self):
        return 'sdk'

    def get_api_context(self):
        newest_version = get_with_prefix(settings.SDK_VERSIONS, self.name)
        newest_name = get_with_prefix(settings.DEPRECATED_SDKS, self.name, self.name)
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
                'url': get_with_prefix(settings.SDK_URLS, newest_name),
            },
        }
