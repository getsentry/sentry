from collections.abc import Callable
from typing import TypedDict, get_args

from sentry.scm.private.ipc import serialize_event
from sentry.scm.private.webhooks.github import parse_github_event
from sentry.scm.types import (
    CheckRunEvent,
    CommentEvent,
    EventType,
    EventTypeHint,
    HybridCloudSilo,
    PullRequestEvent,
    SubscriptionEvent,
)

type CheckRunEventListener = Callable[[CheckRunEvent], None]
type CommentEventListener = Callable[[CommentEvent], None]
type PullRequestEventListener = Callable[[PullRequestEvent], None]
type UnknownEventListener = Callable[[SubscriptionEvent], None]


class EventListeners(TypedDict):
    check_run: dict[str, CheckRunEventListener]
    comment: dict[str, CommentEventListener]
    pull_request: dict[str, PullRequestEventListener]
    unknown: dict[str, UnknownEventListener]


class SourceCodeManagerEventStream:

    def __init__(self):
        self.listeners: EventListeners = {
            "check_run": {},
            "comment": {},
            "pull_request": {},
            "unknown": {},
        }

        for event in get_args(EventTypeHint):
            assert event in self.listeners, f"Missing `{event}` in listeners dictionary"

    def listen_for_check_run(self, fn: CheckRunEventListener) -> CheckRunEventListener:
        self.listeners["check_run"][fn.__name__] = fn
        return fn

    def listen_for_comment(self, fn: CommentEventListener) -> CommentEventListener:
        self.listeners["comment"][fn.__name__] = fn
        return fn

    def listen_for_pull_request(self, fn: PullRequestEventListener) -> PullRequestEventListener:
        self.listeners["pull_request"][fn.__name__] = fn
        return fn

    def listen_for_unknown(self, fn: UnknownEventListener) -> UnknownEventListener:
        self.listeners["unknown"][fn.__name__] = fn
        return fn


def serialize_provider_event(event: SubscriptionEvent) -> tuple[EventTypeHint, EventType]:
    if event["type"] == "github":
        return parse_github_event(event)
    else:
        raise ValueError("Provider not implemented.")


def produce_to_listeners(
    event: SubscriptionEvent,
    silo: HybridCloudSilo,
    produce_to_listener: Callable[[bytes, EventTypeHint, str, HybridCloudSilo], None],
) -> None:
    """
    Accepts a raw SubscriptionEvent and attempts to determine its type before sending it to the
    event-type's listeners to be processed.

    :param event:
    :param silo: Events are processed in the hybrid-cloud silo they are received in.
    :param produce_to_listener:
    """
    event_type_hint, parsed_event = serialize_provider_event(event)
    message = serialize_event(parsed_event, event_type_hint)

    for listener in scm_event_stream.listeners[event_type_hint].keys():
        produce_to_listener(message, event_type_hint, listener, silo)


scm_event_stream = SourceCodeManagerEventStream()
"""
The source code manager (SCM) event-stream singleton allows developers to listen to events from SCM
providers such as GitHub and GitLab. Events are mapped into a standard type before being passed to
registered listeners.

Listeners can be registered by using the `listen_for_*` methods on the `scm_event_stream`]
singleton.

```
@scm_event_stream.listen_for_pull_request
def process_pr_event(event: PullRequestEvent) -> None:
    # Your custom processing logic goes here.
    ...

@scm_event_stream.listen_for_comment
def process_comment_event(event: CommentEvent) -> None:
    # Your custom processing logic goes here.
    ...
```

When registering listeners it is critcal that these listeners are imported into the listeners
module at src/sentry/scm/stream.py. Importing the module registers it with the scm_event_stream
singleton and ensures we can dispatch events to your listener.

Listeners run asynchronously on a task queue; specfically taskbroker. Listeners run in the region
they were scheduled (either a region or control silo). Listeners are logically isolated from one
another. Unhandled exceptions within a listener will only impact that listener and not other
listeners.

SCM listeners will be default collect numerous metrics about runtime performance, total system
performance, and failure-rate. It will also instrument Sentry by default. Every listener has a
trace waterfall in Sentry.

Events will include the raw event bytes received from the SCM service provider. This is provided
as a stop gap measure in case our default event parsing logic does not encompass your use case. The
SCM team has written specialized parsers which will parse the request faster than simple JSON
loading. Please inform us of your use case and we will extend the SCM platform to include your
fields if we are able.
"""
