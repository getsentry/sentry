from __future__ import absolute_import

import re

from hashlib import md5

from django.utils.encoding import force_bytes

from sentry.utils.safe import get_path
from sentry.stacktraces.processing import get_crash_frame_from_event_data


_fingerprint_var_re = re.compile(r"^\{\{\s*(\S+)\s*\}\}$")


def parse_fingerprint_var(value):
    match = _fingerprint_var_re.match(value)
    if match is not None:
        return match.group(1)


def is_default_fingerprint_var(value):
    return parse_fingerprint_var(value) == "default"


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
        var = parse_fingerprint_var(value)
        if var is None:
            return value
        if var == "transaction":
            return event.data.get("transaction") or "<no-transaction>"
        elif var in ("type", "error.type"):
            ty = get_path(event.data, "exception", "values", -1, "type")
            return ty or "<no-type>"
        elif var in ("function", "stack.function"):
            frame = get_crash_frame_from_event_data(event.data)
            func = frame.get("function") if frame else None
            return func or "<no-function>"
        elif var in ("module", "stack.module"):
            frame = get_crash_frame_from_event_data(event.data)
            mod = frame.get("module") if frame else None
            return mod or "<no-module>"
        elif var in ("package", "stack.package"):
            frame = get_crash_frame_from_event_data(event.data)
            pkg = frame.get("package") if frame else None
            if pkg:
                pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            return pkg or "<no-package>"
        elif var == "level":
            return event.data.get("level") or "<no-level>"
        elif var == "logger":
            return event.data.get("logger") or "<no-logger>"
        elif var.startswith("tags."):
            tag = var[5:]
            for t, value in event.data.get("tags") or ():
                if t == tag:
                    return value
            return "<no-value-for-tag-%s>" % tag
        return value

    return [get_fingerprint_value(x) for x in values]
