from __future__ import absolute_import

import re
import six

from hashlib import md5
from collections import OrderedDict

from django.utils.encoding import force_bytes

HASH_RE = re.compile(r'^[0-9a-f]{32}$')
DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])


def md5_from_hash(hash_bits):
    result = md5()
    for bit in hash_bits:
        result.update(force_bytes(bit, errors='replace'))
    return result.hexdigest()


def get_fingerprint_for_event(event):
    fingerprint = event.data.get('fingerprint')
    if fingerprint is None:
        return ['{{ default }}']
    return fingerprint


def get_hashes_for_event(event):
    return get_hashes_for_event_with_reason(event)[1]


def get_hashes_for_event_with_reason(event):
    for interface in six.itervalues(event.interfaces):
        result = interface.compute_hashes(event.platform)
        if not result:
            continue
        return (interface.path, result)

    return ('no_interfaces', [''])


def get_grouping_behavior(event):
    data = event.data
    if data.get('checksum') is not None:
        return ('checksum', data['checksum'])
    fingerprint = get_fingerprint_for_event(event)
    return ('fingerprint', get_hashes_from_fingerprint_with_reason(event, fingerprint))


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


def get_hashes_from_fingerprint_with_reason(event, fingerprint):
    if any(d in fingerprint for d in DEFAULT_FINGERPRINT_VALUES):
        default_hashes = get_hashes_for_event_with_reason(event)
        hash_count = len(default_hashes[1])
    else:
        hash_count = 1

    hashes = OrderedDict((bit, []) for bit in fingerprint)
    for idx in range(hash_count):
        for bit in fingerprint:
            if bit in DEFAULT_FINGERPRINT_VALUES:
                hashes[bit].append(default_hashes)
            else:
                hashes[bit] = bit
    return list(hashes.items())


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
