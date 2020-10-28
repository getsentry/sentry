from __future__ import absolute_import

import re

from hashlib import md5

from django.utils.encoding import force_bytes

from sentry.utils.safe import get_path
from sentry.stacktraces.processing import get_crash_frame_from_event_data


_fingerprint_var_re = re.compile(r"\{\{\s*(\S+)\s*\}\}")


def parse_fingerprint_var(value):
    match = _fingerprint_var_re.match(value)
    if match is not None and match.end() == len(value):
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


def get_fingerprint_value(var, data):
    if var == "transaction":
        return data.get("transaction") or "<no-transaction>"
    elif var in ("type", "error.type"):
        ty = get_path(data, "exception", "values", -1, "type")
        return ty or "<no-type>"
    elif var in ("function", "stack.function"):
        frame = get_crash_frame_from_event_data(data)
        func = frame.get("function") if frame else None
        return func or "<no-function>"
    elif var in ("module", "stack.module"):
        frame = get_crash_frame_from_event_data(data)
        mod = frame.get("module") if frame else None
        return mod or "<no-module>"
    elif var in ("package", "stack.package"):
        frame = get_crash_frame_from_event_data(data)
        pkg = frame.get("package") if frame else None
        if pkg:
            pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        return pkg or "<no-package>"
    elif var == "level":
        return data.get("level") or "<no-level>"
    elif var == "logger":
        return data.get("logger") or "<no-logger>"
    elif var.startswith("tags."):
        tag = var[5:]
        for t, value in data.get("tags") or ():
            if t == tag:
                return value
        return "<no-value-for-tag-%s>" % tag


def resolve_fingerprint_values(values, event_data):
    def _get_fingerprint_value(value):
        var = parse_fingerprint_var(value)
        if var is None:
            return value
        rv = get_fingerprint_value(var, event_data)
        if rv is None:
            return value
        return rv

    return [_get_fingerprint_value(x) for x in values]


def expand_title_template(template, event_data):
    def _handle_match(match):
        var = match.group(1)
        rv = get_fingerprint_value(var, event_data)
        if rv is not None:
            return rv
        return match.group(0)

    return _fingerprint_var_re.sub(_handle_match, template)
