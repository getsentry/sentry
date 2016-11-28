from __future__ import absolute_import

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

        if hasattr(receiver, '__name__'):
            wrapped.__name__ = receiver.__name__
        if hasattr(receiver, '__module__'):
            wrapped.__module__ = receiver.__module__
        if hasattr(receiver, '__doc__'):
            wrapped.__doc__ = receiver.__doc__
        return wrapped(receiver)


regression_signal = BetterSignal(providing_args=["instance"])
buffer_incr_complete = BetterSignal(providing_args=["model", "columns", "extra", "result"])
event_accepted = BetterSignal(providing_args=["ip", "data", "project"])
event_dropped = BetterSignal(providing_args=["ip", "data", "project"])
event_filtered = BetterSignal(providing_args=["ip", "data", "project"])
event_received = BetterSignal(providing_args=["ip", "project"])
pending_delete = BetterSignal(providing_args=['instance', 'actor'])
event_processed = BetterSignal(providing_args=['project', 'group', 'event'])

# Organization Onboarding Signals
project_created = BetterSignal(providing_args=["project", "user"])
first_event_pending = BetterSignal(providing_args=["project", "user"])
first_event_received = BetterSignal(providing_args=["project", "group"])
member_invited = BetterSignal(providing_args=["member", "user"])
member_joined = BetterSignal(providing_args=["member"])
issue_tracker_used = BetterSignal(providing_args=["plugin", "project", "user"])
plugin_enabled = BetterSignal(providing_args=["plugin", "project", "user"])

email_verified = BetterSignal(providing_args=["email"])

mocks_loaded = BetterSignal(providing_args=["project"])
