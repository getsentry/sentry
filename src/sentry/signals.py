from functools import wraps
from django.dispatch import Signal


class BetterSignal(Signal):
    def connect(self, receiver=None, **kwargs):
        """
        Support decorator syntax:

        >>> @signal.connect(sender=type)
        >>> def my_receiver(**kwargs):
        >>>     pass

        """
        def wrapped(func):
            return super(BetterSignal, self).connect(func, **kwargs)

        if receiver is None:
            return wrapped
        return wraps(receiver)(wrapped(receiver))


regression_signal = BetterSignal(providing_args=["instance"])
buffer_incr_complete = BetterSignal(providing_args=["model", "columns", "extra", "result"])
