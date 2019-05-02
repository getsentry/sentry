from __future__ import absolute_import

from hashlib import md5

from django.utils.encoding import force_bytes

DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])


def hash_from_values(values):
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors='replace'))
    return result.hexdigest()
