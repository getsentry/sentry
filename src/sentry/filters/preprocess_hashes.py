from __future__ import absolute_import

import functools
import six

from django.core.cache import cache, get_cache, InvalidCacheBackendError

from sentry.interfaces.base import get_interfaces
from sentry.interfaces.exception import Exception as ExceptionInterface, SingleException
from sentry.interfaces.stacktrace import Frame, Stacktrace
from sentry.event_manager import _get_hashes_from_fingerprint, md5_from_hash


try:
    hash_cache = get_cache('preprocess_hash')
except InvalidCacheBackendError:
    hash_cache = cache


class UnableToGenerateHash(Exception):
    pass


def get_raw_cache_key(project_id, event_id):
    return 'e:raw:{1}:{0}'.format(project_id, event_id)


def get_preprocess_hash_inputs(event):
    return get_preprocess_hash_inputs_with_reason(event)[1]


def get_preprocess_hash_inputs_with_reason(data):
    interfaces = get_interfaces(data)
    platform = data['platform']
    for interface in six.itervalues(interfaces):
        kwargs = {'is_processed_data': False}
        if isinstance(interface, SingleException):
            kwargs['platform'] = platform
        elif isinstance(interface, (ExceptionInterface, Stacktrace, Frame)):
            # normalize_in_app hasn't run on the data, so
            # `in_app` isn't necessarily accurate
            kwargs.update({
                'platform': platform,
                'system_frames': True,
            })
        result = interface.get_hash(**kwargs)
        if result:
            return (interface.get_path(), [result])

    raise UnableToGenerateHash


def get_preprocess_hashes_from_fingerprint(data, fingerprint):
    return _get_hashes_from_fingerprint(
        functools.partial(get_preprocess_hash_inputs, data),
        fingerprint,
    )


def get_preprocess_hashes(data):
    fingerprint = data.get('fingerprint')

    if fingerprint:
        hashes = [
            md5_from_hash(h) for h in get_preprocess_hashes_from_fingerprint(data, fingerprint)
        ]
    elif data.get('checksum'):
        hashes = [data['checksum']]
    else:
        hashes = [md5_from_hash(h) for h in get_preprocess_hash_inputs(data)]

    return hashes
