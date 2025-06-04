from threading import Lock

from sentry.utils.imports import import_string


class PatchContext:
    def __init__(self, target, callback):
        target, attr = target.rsplit(".", 1)
        target = import_string(target)
        self.target = target
        self.attr = attr
        self.callback = callback
        self._lock = Lock()
        with self._lock:
            self.func = getattr(target, attr)

    def __enter__(self):
        self.patch()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.unpatch()

    def patch(self):
        with self._lock:
            func = getattr(self.target, self.attr)

            def wrapped(*args, **kwargs):
                __traceback_hide__ = True  # NOQA
                return self.callback(self.func, *args, **kwargs)

            wrapped.__name__ = func.__name__
            if hasattr(func, "__doc__"):
                wrapped.__doc__ = func.__doc__
            if hasattr(func, "__module__"):
                wrapped.__module__ = func.__module__

            setattr(self.target, self.attr, wrapped)

    def unpatch(self):
        with self._lock:
            setattr(self.target, self.attr, self.func)
