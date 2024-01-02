from __future__ import annotations

import enum
import functools
import logging
from typing import Any, Callable, List, Tuple, Union

from django.dispatch.dispatcher import NO_RECEIVERS, Signal

from sentry.utils.env import in_test_environment

Receiver = Callable[[], Any]

_AllReceivers = enum.Enum("_AllReceivers", "ALL")


_receivers_that_raise: _AllReceivers | List[Receiver] = []


class receivers_raise_on_send:
    """
    Testing utility that forces send_robust to raise, rather than return, exceptions for signal receivers
    that match the given receivers within the context.  The default receivers mode is to raise all receiver exceptions.

    This behavior only works in tests.
    """

    receivers: Any

    def __init__(self, receivers: _AllReceivers | Receiver | List[Receiver] = _AllReceivers.ALL):
        self.receivers = receivers

    def __enter__(self) -> None:
        global _receivers_that_raise
        self.old = _receivers_that_raise

        if self.receivers is _AllReceivers.ALL:
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

    def send_robust(self, sender, **named) -> List[Tuple[Receiver, Union[Exception, Any]]]:
        """
        A reimplementation of send_robust which logs failures, thus recovering stacktraces.
        """
        responses: List[Tuple[Receiver, Union[Exception, Any]]] = []
        if not self.receivers or self.sender_receivers_cache.get(sender) is NO_RECEIVERS:
            return responses

        # Call each receiver with whatever arguments it can accept.
        # Return a list of tuple pairs [(receiver, response), ... ].
        for receiver in self._live_receivers(sender):
            try:
                response = receiver(signal=self, sender=sender, **named)
            except Exception as err:
                if in_test_environment():
                    if (
                        _receivers_that_raise is _AllReceivers.ALL
                        or receiver in _receivers_that_raise
                    ):
                        raise

                logging.exception("signal.failure", extra={"receiver": repr(receiver)})
                responses.append((receiver, err))
            else:
                responses.append((receiver, response))
        return responses


buffer_incr_complete = BetterSignal()  # ["model", "columns", "extra", "result"]
pending_delete = BetterSignal()  # ["instance", "actor"]
event_processed = BetterSignal()  # ["project", "event"]
# When the organization and initial member have been created
org_setup_complete = BetterSignal()  # ["organization", "user"]

# This signal should eventually be removed as we should not send
# transactions through post processing
transaction_processed = BetterSignal()  # ["project", "event"]

# DEPRECATED
event_received = BetterSignal()  # ["ip", "project"]
event_accepted = BetterSignal()  # ["ip", "data", "project"]

# Organization Onboarding Signals
project_created = BetterSignal()  # ["project", "user", "user_id", "default_rules"]

first_event_received = BetterSignal()  # ["project", "event"]
# We use signal for consistency with other places but
# would like to get rid of the signal since it doesn’t serve any purpose
first_event_with_minified_stack_trace_received = BetterSignal()  # ["project", "event"]
first_transaction_received = BetterSignal()  # ["project", "event"]
first_profile_received = BetterSignal()  # ["project"]
first_replay_received = BetterSignal()  # ["project"]
first_feedback_received = BetterSignal()  # ["project"]
first_new_feedback_received = BetterSignal()  # ["project"]
first_cron_monitor_created = BetterSignal()  # ["project", "user", "from_upsert"]
cron_monitor_created = BetterSignal()  # ["project", "user", "from_upsert"]
first_cron_checkin_received = BetterSignal()  # ["project", "monitor_id"]
member_invited = BetterSignal()  # ["member", "user"]
member_joined = BetterSignal()  # ["organization_member_id", "organization_id", "user_id"]
issue_tracker_used = BetterSignal()  # ["plugin", "project", "user"]
plugin_enabled = BetterSignal()  # ["plugin", "project", "user"]

email_verified = BetterSignal()  # ["email"]

mocks_loaded = BetterSignal()  # ["project"]

user_feedback_received = BetterSignal()  # ["project"]

advanced_search = BetterSignal()  # ["project"]
advanced_search_feature_gated = BetterSignal()  # ["organization", "user"]
save_search_created = BetterSignal()  # ["project", "user"]
inbound_filter_toggled = BetterSignal()  # ["project"]
sso_enabled = BetterSignal()  # ["organization_id", "user_id", "provider"]
data_scrubber_enabled = BetterSignal()  # ["organization"]
# ["project", "rule", "user", "rule_type", "is_api_token", "duplicate_rule", "wizard_v3"]
alert_rule_created = BetterSignal()
alert_rule_edited = BetterSignal()  # ["project", "rule", "user", "rule_type", "is_api_token"]
repo_linked = BetterSignal()  # ["repo", "user"]
release_created = BetterSignal()  # ["release"]
deploy_created = BetterSignal()  # ["deploy"]
ownership_rule_created = BetterSignal()  # ["project"]

# issues
issue_assigned = BetterSignal()  # ["project", "group", "user"]
issue_unassigned = BetterSignal()  # ["project", "group", "user"]
issue_deleted = BetterSignal()  # ["group", "user", "delete_type"]
# ["organization_id", "project", "group", "user", "resolution_type"]
issue_resolved = BetterSignal()
issue_unresolved = BetterSignal()  # ["project", "user", "group", "transition_type"]
issue_ignored = BetterSignal()  # ["project", "user", "group_list", "activity_data"]
issue_archived = BetterSignal()  # ["project", "user", "group_list", "activity_data"]
issue_escalating = BetterSignal()  # ["project", "group", "event", "was_until_escalating"]
issue_unignored = BetterSignal()  # ["project", "user_id", "group", "transition_type"]
issue_mark_reviewed = BetterSignal()  # ["project", "user", "group"]

# comments
comment_created = BetterSignal()  # ["project", "user", "group", "activity_data"]
comment_updated = BetterSignal()  # ["project", "user", "group", "activity_data"]
comment_deleted = BetterSignal()  # ["project", "user", "group", "activity_data"]

terms_accepted = BetterSignal()  # ["organization", "organization_id", "user", "ip_address"]
team_created = (
    BetterSignal()
)  # ["organization", "user", "team", "team_id", "organization_id", "user_id"]
integration_added = BetterSignal()  # ["integration_id", "organization_id", "user_id"]
integration_issue_created = BetterSignal()  # ["integration", "organization", "user"]
integration_issue_linked = BetterSignal()  # ["integration", "organization", "user"]

monitor_environment_failed = BetterSignal()  # ["monitor"]

# experiments
join_request_created = BetterSignal()  # ["member"]
join_request_link_viewed = BetterSignal()  # ["organization"]
user_signup = BetterSignal()  # ["user", "source"]

# relocation
relocated = BetterSignal()  # ["relocation_uuid"]

# After `sentry upgrade` has completed.  Better than post_migrate because it won't run in tests.
post_upgrade = BetterSignal()  # []
