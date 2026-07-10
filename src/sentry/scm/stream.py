# Import your listeners below this line. You'll need to ensure your listener is
# uniquely named. You can alias it here as "my_check_run_listener" or name it
# uniquely by default.
#
# Example:
#
#    from sentry.my_module import check_run_listener, pull_request_listener
from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import (
    CheckRunEvent,
    CommentEvent,
    EventType,
    PullRequestEvent,
    SubscriptionEvent,
)

# DEFAULT LISTENERS
#
# TODO: Remove after production testing.


@scm_event_stream.listen_for(event_type="check_run")
def listen_for_check_run(e):
    return None


@scm_event_stream.listen_for(event_type="comment")
def listen_for_comment(e):
    return None


@scm_event_stream.listen_for(event_type="pull_request")
def listen_for_pull_request(e):
    return None


# Do not re-export your listener here.
__all__ = [
    "scm_event_stream",
    "EventType",
    "CommentEvent",
    "PullRequestEvent",
    "CheckRunEvent",
    "SubscriptionEvent",
]
