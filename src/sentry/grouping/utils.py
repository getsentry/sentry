from __future__ import absolute_import

from hashlib import md5

from django.utils.encoding import force_bytes

DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])
TRANSACTION_FINGERPRINT_VALUES = frozenset(['{{ transaction }}', '{{transaction}}'])


def hash_from_values(values):
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors='replace'))
    return result.hexdigest()


def get_rule_bool(value):
    if value:
        value = value.lower()
        if value in ('1', 'yes', 'true'):
            return True
        elif value in ('0', 'no', 'false'):
            return False


def resolve_fingerprint_values(values, event):
    def get_fingerprint_value(value):
        if value in TRANSACTION_FINGERPRINT_VALUES:
            return event.data.get('transaction') or '<no-transaction>'
        return value
    return [get_fingerprint_value(x) for x in values]
