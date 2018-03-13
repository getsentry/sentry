from __future__ import absolute_import

import logging

from django.dispatch.dispatcher import NO_RECEIVERS, Signal


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

    def send_robust(self, sender, **named):
        """
        A reimplementation of send_robust which logs failures, thus recovering stacktraces.
        """
        responses = []
        if not self.receivers or self.sender_receivers_cache.get(sender) is NO_RECEIVERS:
            return responses

        # Call each receiver with whatever arguments it can accept.
        # Return a list of tuple pairs [(receiver, response), ... ].
        for receiver in self._live_receivers(sender):
            try:
                response = receiver(signal=self, sender=sender, **named)
            except Exception as err:
                logging.error('signal.failure', extra={
                    'receiver': repr(receiver),
                }, exc_info=True)
                responses.append((receiver, err))
            else:
                responses.append((receiver, response))
        return responses


regression_signal = BetterSignal(providing_args=["instance"])
buffer_incr_complete = BetterSignal(providing_args=["model", "columns", "extra", "result"])
event_accepted = BetterSignal(providing_args=["ip", "data", "project"])
event_discarded = BetterSignal(providing_args=["project"])
event_dropped = BetterSignal(providing_args=["ip", "data", "project", "reason_code"])
event_filtered = BetterSignal(providing_args=["ip", "data", "project"])
event_received = BetterSignal(providing_args=["ip", "project"])
pending_delete = BetterSignal(providing_args=['instance', 'actor'])
event_processed = BetterSignal(providing_args=['project', 'group', 'event'])
event_saved = BetterSignal(providing_args=["project"])

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

user_feedback_received = BetterSignal(providing_args=["project"])
issue_assigned = BetterSignal(providing_args=["project", "group"])
issue_resolved_in_release = BetterSignal(providing_args=["project"])
advanced_search = BetterSignal(providing_args=["project"])
save_search_created = BetterSignal(providing_args=["project"])
inbound_filter_toggled = BetterSignal(providing_args=["project"])
sso_enabled = BetterSignal(providing_args=["organization"])
data_scrubber_enabled = BetterSignal(providing_args=["organization"])
alert_rule_created = BetterSignal(providing_args=["project", "rule"])

terms_accepted = BetterSignal(providing_args=["organization", "user", "ip_address"])
