from __future__ import absolute_import

import os

from sentry.utils.safe import get_path


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), os.pardir, "fixtures", "native", name)


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

    return stacktrace


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
                    strip_stacktrace_container(x)
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
            "contexts": event.get("contexts"),
            "errors": [e for e in event.get("errors") or () if e.get("name") != "timestamp"],
        },
        **kwargs
    )
