from __future__ import absolute_import


from sentry.utils.safe import get_path


def has_sourcemap(event):
    if event.platform not in ("javascript", "node"):
        return False

    for exception in get_path(event.data, "exception", "values", filter=True, default=()):
        for frame in get_path(exception, "stacktrace", "frames", filter=True, default=()):
            if "sourcemap" in (frame.get("data") or ()):
                return True

    return False
