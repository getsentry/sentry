from __future__ import absolute_import

import os


def get_fixture_path(name):
    return os.path.join(
        os.path.dirname(__file__),
        os.pardir,
        'fixtures',
        'native',
        name,
    )


def insta_snapshot_stacktrace_data(self, event):
    self.insta_snapshot({
        "stacktrace": event.get('stacktrace'),
        "exception": event.get('exception'),
        "threads": event.get('threads'),
        "debug_meta": event.get('debug_meta'),
        "contexts": event.get('contexts'),
        "errors": event.get('errors'),
    })
