from __future__ import absolute_import

from hashlib import md5

from django.utils.encoding import force_bytes

from sentry.utils.safe import get_path
from sentry.stacktraces.processing import get_crash_frame_from_event_data


DEFAULT_FINGERPRINT_VALUES = frozenset(["{{ default }}", "{{default}}"])
TRANSACTION_FINGERPRINT_VALUES = frozenset(["{{ transaction }}", "{{transaction}}"])
EXCEPTION_TYPE_FINGERPRINT_VALUES = frozenset(["{{ type }}", "{{type}}"])
FUNCTION_FINGERPRINT_VALUES = frozenset(["{{ function }}", "{{function}}"])
MODULE_FINGERPRINT_VALUES = frozenset(["{{ module }}", "{{module}}"])
PACKAGE_FINGERPRINT_VALUES = frozenset(["{{ package }}", "{{package}}"])


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


def resolve_fingerprint_values(values, event):
    def get_fingerprint_value(value):
        if value in TRANSACTION_FINGERPRINT_VALUES:
            return event.data.get("transaction") or "<no-transaction>"
        elif value in EXCEPTION_TYPE_FINGERPRINT_VALUES:
            ty = get_path(event.data, "exception", "values", -1, "type")
            return ty or "<no-type>"
        elif value in FUNCTION_FINGERPRINT_VALUES:
            frame = get_crash_frame_from_event_data(event.data)
            func = frame.get("function") if frame else None
            return func or "<no-function>"
        elif value in MODULE_FINGERPRINT_VALUES:
            frame = get_crash_frame_from_event_data(event.data)
            mod = frame.get("module") if frame else None
            return mod or "<no-module>"
        elif value in PACKAGE_FINGERPRINT_VALUES:
            frame = get_crash_frame_from_event_data(event.data)
            pkg = frame.get("package") if frame else None
            if pkg:
                pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            return pkg or "<no-package>"
        return value

    return [get_fingerprint_value(x) for x in values]
