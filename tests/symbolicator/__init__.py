from __future__ import absolute_import


def insta_snapshot_stacktrace_data(self, event):
    self.insta_snapshot({
        "stacktrace": event.get('stacktrace'),
        "exception": event.get('exception'),
        "threads": event.get('threads'),
        "debug_meta": event.get('debug_meta'),
        "contexts": event.get('contexts'),
        "errors": event.get('errors'),
    })
