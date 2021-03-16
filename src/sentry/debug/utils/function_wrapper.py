from time import time


class FunctionWrapper:
    def __init__(self, collector):
        self.collector = collector

    def __call__(self, func, *args, **kwargs):
        __traceback_hide__ = True  # NOQA

        start = time()
        try:
            return func(*args, **kwargs)
        finally:
            end = time()

            if getattr(func, "im_class", None):
                arg_str = repr(args[1:])
            else:
                arg_str = repr(args)

            data = {
                "name": func.__name__,
                "args": arg_str,
                "kwargs": repr(kwargs),
                "start": start,
                "end": end,
            }
            self.record(data)

    def record(self, data):
        self.collector.append(data)
