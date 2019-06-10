from __future__ import absolute_import

import logging

__all__ = ('Sdk', )

from distutils.version import LooseVersion
from django.conf import settings

from sentry.interfaces.base import Interface, prune_empty_keys
from sentry.net.http import Session
from sentry.cache import default_cache


logger = logging.getLogger(__name__)


SDK_INDEX_CACHE_KEY = u'sentry:sdk-versions'


def get_sdk_index():
    value = default_cache.get(SDK_INDEX_CACHE_KEY)
    if value is not None:
        return value

    base_url = settings.SENTRY_RELEASE_REGISTRY_BASEURL
    if not base_url:
        return {}

    url = '%s/sdks' % (base_url,)

    try:
        with Session() as session:
            response = session.get(url, timeout=1)
            response.raise_for_status()
            json = response.json()
    except Exception:
        logger.exception("Failed to fetch version index from release registry")
        json = {}

    default_cache.set(SDK_INDEX_CACHE_KEY, json, 3600)
    return json


def get_sdk_versions():
    try:
        rv = settings.SDK_VERSIONS
        rv.update((key, info['value']) for (key, info) in get_sdk_index().items())
        return rv
    except Exception:
        logger.exception("sentry-release-registry.sdk-versions")
        return {}


def get_sdk_urls():
    try:
        rv = settings.SDK_URLS
        rv.update((key, info['docs_url']) for (key, info) in get_sdk_versions())
        return rv
    except Exception:
        logger.exception("sentry-release-registry.sdk-urls")
        return {}


def get_with_prefix(d, k, default=None, delimiter=":"):
    """\
    Retrieve a value from the dictionary, falling back to using its
    prefix, denoted by a delimiter (default ':'). Useful for cases
    such as looking up `raven-java:logback` in a dict like
    {"raven-java": "7.0.0"}.
    """

    if k is None:
        return default

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
    >>>     "name": "sentry.java",
    >>>     "version": "1.7.10",
    >>>     "integrations": ["log4j"],
    >>>     "packages": [
    >>>         {
    >>>             "name": "maven:io.sentry.sentry",
    >>>             "version": "1.7.10",
    >>>         }
    >>>     ]
    >>> }
    """

    @classmethod
    def to_python(cls, data):
        for key in (
            'name',
            'version',
            'integrations',
            'packages',
        ):
            data.setdefault(key, None)

        return cls(**data)

    def to_json(self):
        return prune_empty_keys({
            'name': self.name,
            'version': self.version,
            'integrations': self.integrations or None,
            'packages': self.packages or None
        })

    def get_api_context(self, is_public=False, platform=None):
        newest_version = get_with_prefix(get_sdk_versions(), self.name)
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
            'upstream': {
                'name': newest_name,
                # when this is correct we can make it available
                # 'version': newest_version,
                'isNewer': is_newer,
                'url': get_with_prefix(get_sdk_urls(), newest_name),
            },
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {
            '': meta.get(''),
            'name': meta.get('name'),
            'version': meta.get('version'),
        }
