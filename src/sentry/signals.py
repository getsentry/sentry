from __future__ import absolute_import

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
event_received = BetterSignal(providing_args=["ip"])
pending_delete = BetterSignal(providing_args=["instance"])
event_processed = BetterSignal(providing_args=['project', 'group', 'event'])
first_event = BetterSignal(providing_args=["instance"])
