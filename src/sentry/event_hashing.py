from __future__ import absolute_import

import re
import six

from hashlib import md5

from django.utils.encoding import force_bytes

HASH_RE = re.compile(r'^[0-9a-f]{32}$')
DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])


def md5_from_hash(hash_bits):
    result = md5()
    for bit in hash_bits:
        result.update(force_bytes(bit, errors='replace'))
    return result.hexdigest()


def get_hashes_for_event(event):
    interfaces = event.get_interfaces()
    for interface in six.itervalues(interfaces):
        result = interface.compute_hashes(event.platform)
        if not result:
            continue
        return result
    return ['']


def get_hashes_from_fingerprint(event, fingerprint):
    if any(d in fingerprint for d in DEFAULT_FINGERPRINT_VALUES):
        default_hashes = get_hashes_for_event(event)
        hash_count = len(default_hashes)
    else:
        hash_count = 1

    hashes = []
    for idx in range(hash_count):
        result = []
        for bit in fingerprint:
            if bit in DEFAULT_FINGERPRINT_VALUES:
                result.extend(default_hashes[idx])
            else:
                result.append(bit)
        hashes.append(result)
    return hashes


def calculate_event_hashes(event):
    # If a checksum is set, use that one.
    checksum = event.data.get('checksum')
    if checksum:
        if HASH_RE.match(checksum):
            return [checksum]
        return [md5_from_hash([checksum]), checksum]

    # Otherwise go with the new style fingerprint code
    fingerprint = event.data.get('fingerprint') or ['{{ default }}']
    return [md5_from_hash(h) for h in get_hashes_from_fingerprint(event, fingerprint)]
