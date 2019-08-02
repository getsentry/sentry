from __future__ import absolute_import

from hashlib import md5

from django.utils.encoding import force_bytes

DEFAULT_FINGERPRINT_VALUES = frozenset(["{{ default }}", "{{default}}"])


def hash_from_values(values):
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors="replace"))
    return result.hexdigest()


def get_rule_bool(value):
    if value:
        value = value.lower()
        if value in ("1", "yes", "true"):
            return True
        elif value in ("0", "no", "false"):
            return False
