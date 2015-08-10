from __future__ import absolute_import

from sentry.utils.imports import import_string


class PatchContext(object):
    def __init__(self, target, callback):
        target, attr = target.rsplit('.', 1)
        target = import_string(target)
        self.func = getattr(target, attr)
        self.target = target
        self.attr = attr
        self.callback = callback

    def __enter__(self):
        self.patch()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.unpatch()

    def patch(self):
        func = getattr(self.target, self.attr)

        def wrapped(*args, **kwargs):
            __traceback_hide__ = True  # NOQA
            return self.callback(self.func, *args, **kwargs)

        wrapped.__name__ = func.__name__
        if hasattr(func, '__doc__'):
            wrapped.__doc__ = func.__doc__
        if hasattr(func, '__module__'):
            wrapped.__module__ = func.__module__

        setattr(self.target, self.attr, wrapped)

    def unpatch(self):
        setattr(self.target, self.attr, self.func)
