from __future__ import absolute_import

import re
import six

from hashlib import md5

from django.utils.encoding import force_bytes

HASH_RE = re.compile(r'^[0-9a-f]{32}$')
DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])


DEFAULT_HINTS = {
    '!salt': 'a static salt',
}


class GroupingComponent(object):

    def __init__(self, id, hint=None, contributes=True, values=None):
        self.id = id
        if hint is None:
            hint = DEFAULT_HINTS.get(id)
        self.hint = hint
        self.contributes = contributes
        if values is None:
            values = []
        self.values = values

    def update(self, hint=None, contributes=None, values=None):
        if hint is not None:
            self.hint = hint
        if contributes is not None:
            self.contributes = contributes
        if values is not None:
            self.values = values

    def flatten_values(self):
        rv = []
        if self.contributes:
            for value in self.values:
                if isinstance(value, GroupingComponent):
                    rv.extend(value.flatten_values())
                else:
                    rv.append(value)
        return rv

    def as_dict(self):
        rv = {'id': self.id, 'contributes': self.contributes, 'hint': self.hint, 'values': []}
        for value in self.values:
            if isinstance(value, GroupingComponent):
                rv['values'].append(value.as_dict())
            else:
                rv['values'].append(value)
        return rv

    def __repr__(self):
        return 'GroupingComponent(%r, hint=%r, contributes=%r, values=%r)' % (
            self.id,
            self.hint,
            self.contributes,
            self.values,
        )


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
