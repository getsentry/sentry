import re

from sentry.utils.safe import get_path


def strip_frame(frame):
    if frame:
        frame = {
            "data": {
                "symbolicator_status": get_path(frame, "data", "symbolicator_status"),
                "orig_in_app": get_path(frame, "data", "orig_in_app"),
            },
            "function": frame.get("function"),
            "instruction_addr": frame.get("instruction_addr"),
            "symbol": frame.get("symbol"),
            "package": frame.get("package"),
            "lineno": frame.get("lineno"),
            "in_app": frame.get("in_app"),
            "trust": frame.get("trust"),
        }

    return frame


def strip_stacktrace(stacktrace):
    if stacktrace:
        stacktrace = dict(stacktrace)
        stacktrace["frames"] = [strip_frame(x) for x in stacktrace.get("frames") or ()]
        try:
            stacktrace["registers"] = {k: v for k, v in stacktrace["registers"].items()}
        except KeyError:
            pass

    return stacktrace


STRIP_TRAILING_ADDR_RE = re.compile(" ?/ 0x[0-9a-fA-F]+$")


def strip_trailing_addr(value):
    return STRIP_TRAILING_ADDR_RE.sub("", value)


def normalize_native_exception(exc):
    if exc:
        exc = dict(exc)
        exc["type"] = strip_trailing_addr(exc["type"])
        exc["value"] = strip_trailing_addr(exc["value"])

    return exc


def strip_stacktrace_container(container):
    if container:
        container = dict(container)
        container["stacktrace"] = strip_stacktrace(container.get("stacktrace"))
        container["raw_stacktrace"] = strip_stacktrace(container.get("raw_stacktrace"))

    return container


def insta_snapshot_native_stacktrace_data(self, event, **kwargs):
    # limit amount of data going into a snapshot so that they don't break all
    # the time due to unrelated changes.
    self.insta_snapshot(
        {
            "stacktrace": strip_stacktrace(event.get("stacktrace")),
            "exception": {
                "values": [
                    normalize_native_exception(strip_stacktrace_container(x))
                    for x in get_path(event, "exception", "values") or ()
                ]
            },
            "threads": {
                "values": [
                    strip_stacktrace_container(x)
                    for x in get_path(event, "threads", "values") or ()
                ]
            },
            "debug_meta": event.get("debug_meta"),
            "contexts": {
                k: v for k, v in (event.get("contexts") or {}).items() if k != "reprocessing"
            }
            or None,
            "errors": [e for e in event.get("errors") or () if e.get("name") != "timestamp"],
        },
        **kwargs,
    )


def insta_snapshot_javascript_stacktrace_data(insta_snapshot, event):
    # limit amount of data going into a snapshot so that they don't break all
    # the time due to unrelated changes.
    insta_snapshot(
        {
            "exception": {"values": [x for x in get_path(event, "exception", "values") or ()]},
            "errors": [e for e in event.get("errors") or () if e.get("name") != "timestamp"],
        }
    )


def redact_location(candidates):
    """Redacts the sentry location URI to be independent of the specific ID.

    This modifies the data passed in, returns None.
    """
    location_re = re.compile("^sentry://project_debug_file/[0-9]+$")
    for candidate in candidates:
        try:
            location = candidate["location"]
        except KeyError:
            continue
        else:
            if location_re.search(location):
                candidate["location"] = "sentry://project_debug_file/x"
