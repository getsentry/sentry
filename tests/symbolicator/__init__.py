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


NORMALIZED_REGISTERS = {}


def normalize_register(name):
    return NORMALIZED_REGISTERS.get(name, name)


def strip_stacktrace(stacktrace):
    if stacktrace:
        stacktrace = dict(stacktrace)
        stacktrace["frames"] = [strip_frame(x) for x in stacktrace.get("frames") or ()]
        try:
            stacktrace["registers"] = {
                normalize_register(k): v for k, v in stacktrace["registers"].items()
            }
        except KeyError:
            pass

    return stacktrace


STRIP_TRAILING_ADDR_RE = re.compile(" ?/ 0x[0-9a-fA-F]+$")


def strip_trailing_addr(value):
    return STRIP_TRAILING_ADDR_RE.sub("", value)


def normalize_exception(exc):
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


def insta_snapshot_stacktrace_data(self, event, **kwargs):
    # limit amount of data going into a snapshot so that they don't break all
    # the time due to unrelated changes.
    self.insta_snapshot(
        {
            "stacktrace": strip_stacktrace(event.get("stacktrace")),
            "exception": {
                "values": [
                    normalize_exception(strip_stacktrace_container(x))
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
