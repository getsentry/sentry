from __future__ import annotations

import functools
import logging
import sys
from typing import Any, Callable, List

from django.dispatch.dispatcher import NO_RECEIVERS, Signal

_all = object()
_receivers_that_raise = []


class receivers_raise_on_send:
    """
    Testing utility that forces send_robust to raise, rather than return, exceptions for signal receivers
    that match the given receivers within the context.  The default receivers mode is to raise all receiver exceptions.

    This behavior only works in tests.
    """

    receivers: Any

    def __init__(self, receivers: Any | List[Any] = _all):
        self.receivers = receivers

    def __enter__(self) -> None:
        global _receivers_that_raise
        self.old = _receivers_that_raise

        if self.receivers is _all:
            _receivers_that_raise = self.receivers
        else:
            _receivers_that_raise += self.receivers

    def __call__(self, f: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(f)
        def wrapped(*args: Any, **kwds: Any) -> Any:
            with receivers_raise_on_send(self.receivers):
                return f(*args, **kwds)

        return wrapped

    def __exit__(self, *args) -> bool | None:
        global _receivers_that_raise
        _receivers_that_raise = self.old
        return None


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

        if hasattr(receiver, "__name__"):
            wrapped.__name__ = receiver.__name__
        if hasattr(receiver, "__module__"):
            wrapped.__module__ = receiver.__module__
        if hasattr(receiver, "__doc__"):
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
                if "pytest" in sys.modules:
                    if _receivers_that_raise is _all or receiver in _receivers_that_raise:
                        raise

                logging.error("signal.failure", extra={"receiver": repr(receiver)}, exc_info=True)
                responses.append((receiver, err))
            else:
                responses.append((receiver, response))
        return responses


buffer_incr_complete = BetterSignal(providing_args=["model", "columns", "extra", "result"])
pending_delete = BetterSignal(providing_args=["instance", "actor"])
event_processed = BetterSignal(providing_args=["project", "event"])
# When the organization and initial member have been created
org_setup_complete = BetterSignal(providing_args=["organization", "user"])

# This signal should eventually be removed as we should not send
# transactions through post processing
transaction_processed = BetterSignal(providing_args=["project", "event"])

# DEPRECATED
event_received = BetterSignal(providing_args=["ip", "project"])
event_accepted = BetterSignal(providing_args=["ip", "data", "project"])

# Organization Onboarding Signals
project_created = BetterSignal(providing_args=["project", "user", "default_rules"])
first_event_pending = BetterSignal(providing_args=["project", "user"])

first_event_received = BetterSignal(providing_args=["project", "event"])
# We use signal for consistency with other places but
# would like to get rid of the signal since it doesn’t serve any purpose
first_event_with_minified_stack_trace_received = BetterSignal(providing_args=["project", "event"])
first_transaction_received = BetterSignal(providing_args=["project", "event"])
first_profile_received = BetterSignal(providing_args=["project"])
first_replay_received = BetterSignal(providing_args=["project"])
first_cron_monitor_created = BetterSignal(providing_args=["project", "user", "from_upsert"])
first_cron_checkin_received = BetterSignal(providing_args=["project", "monitor_id"])
member_invited = BetterSignal(providing_args=["member", "user"])
member_joined = BetterSignal(providing_args=["member", "organization_id"])
issue_tracker_used = BetterSignal(providing_args=["plugin", "project", "user"])
plugin_enabled = BetterSignal(providing_args=["plugin", "project", "user"])

email_verified = BetterSignal(providing_args=["email"])

mocks_loaded = BetterSignal(providing_args=["project"])

user_feedback_received = BetterSignal(providing_args=["project"])

advanced_search = BetterSignal(providing_args=["project"])
advanced_search_feature_gated = BetterSignal(providing_args=["organization", "user"])
save_search_created = BetterSignal(providing_args=["project", "user"])
inbound_filter_toggled = BetterSignal(providing_args=["project"])
sso_enabled = BetterSignal(providing_args=["organization", "user", "provider"])
data_scrubber_enabled = BetterSignal(providing_args=["organization"])
alert_rule_created = BetterSignal(
    providing_args=[
        "project",
        "rule",
        "user",
        "rule_type",
        "is_api_token",
        "duplicate_rule",
        "wizard_v3",
    ]
)
alert_rule_edited = BetterSignal(
    providing_args=["project", "rule", "user", "rule_type", "is_api_token"]
)
repo_linked = BetterSignal(providing_args=["repo", "user"])
release_created = BetterSignal(providing_args=["release"])
deploy_created = BetterSignal(providing_args=["deploy"])
ownership_rule_created = BetterSignal(providing_args=["project"])

# issues
issue_assigned = BetterSignal(providing_args=["project", "group", "user"])
issue_deleted = BetterSignal(providing_args=["group", "user", "delete_type"])
issue_resolved = BetterSignal(
    providing_args=["organization_id", "project", "group", "user", "resolution_type"]
)
issue_unresolved = BetterSignal(providing_args=["project", "user", "group", "transition_type"])
issue_ignored = BetterSignal(providing_args=["project", "user", "group_list", "activity_data"])
issue_archived = BetterSignal(providing_args=["project", "user", "group_list", "activity_data"])
issue_escalating = BetterSignal(providing_args=["project", "group", "event"])
issue_unignored = BetterSignal(providing_args=["project", "user_id", "group", "transition_type"])
issue_mark_reviewed = BetterSignal(providing_args=["project", "user", "group"])

# comments
comment_created = BetterSignal(providing_args=["project", "user", "group", "activity_data"])
comment_updated = BetterSignal(providing_args=["project", "user", "group", "activity_data"])
comment_deleted = BetterSignal(providing_args=["project", "user", "group", "activity_data"])
inbox_in = BetterSignal(providing_args=["project", "user", "group", "reason"])
inbox_out = BetterSignal(
    providing_args=["project", "user", "group", "action", "inbox_date_added", "referrer"]
)

terms_accepted = BetterSignal(providing_args=["organization", "user", "ip_address"])
team_created = BetterSignal(providing_args=["organization", "user", "team"])
integration_added = BetterSignal(providing_args=["integration", "organization", "user"])
integration_issue_created = BetterSignal(providing_args=["integration", "organization", "user"])
integration_issue_linked = BetterSignal(providing_args=["integration", "organization", "user"])

monitor_environment_failed = BetterSignal(providing_args=["monitor"])

# experiments
join_request_created = BetterSignal(providing_args=["member"])
join_request_link_viewed = BetterSignal(providing_args=["organization"])
user_signup = BetterSignal(providing_args=["user", "source"])
