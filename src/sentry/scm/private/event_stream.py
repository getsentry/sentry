from collections.abc import Callable
from typing import Literal, overload

from sentry.scm.types import (
    CheckRunEvent,
    CheckSuiteEvent,
    CommentEvent,
    PullRequestEvent,
    PullRequestReviewEvent,
)

type CheckRunEventListener = Callable[[CheckRunEvent], None]
type CheckSuiteEventListener = Callable[[CheckSuiteEvent], None]
type CommentEventListener = Callable[[CommentEvent], None]
type PullRequestEventListener = Callable[[PullRequestEvent], None]
type PullRequestReviewEventListener = Callable[[PullRequestReviewEvent], None]


class SourceCodeManagerEventStream:
    def __init__(self):
        self.check_run_listeners: dict[str, CheckRunEventListener] = {}
        self.check_suite_listeners: dict[str, CheckSuiteEventListener] = {}
        self.comment_listeners: dict[str, CommentEventListener] = {}
        self.pull_request_listeners: dict[str, PullRequestEventListener] = {}
        self.pull_request_review_listeners: dict[str, PullRequestReviewEventListener] = {}

    def listen_for_check_run(self, fn: CheckRunEventListener) -> CheckRunEventListener:
        self.check_run_listeners[fn.__name__] = fn
        return fn

    def listen_for_check_suite(self, fn: CheckSuiteEventListener) -> CheckSuiteEventListener:
        self.check_suite_listeners[fn.__name__] = fn
        return fn

    def listen_for_comment(self, fn: CommentEventListener) -> CommentEventListener:
        self.comment_listeners[fn.__name__] = fn
        return fn

    def listen_for_pull_request(self, fn: PullRequestEventListener) -> PullRequestEventListener:
        self.pull_request_listeners[fn.__name__] = fn
        return fn

    def listen_for_pull_request_review(
        self, fn: PullRequestReviewEventListener
    ) -> PullRequestReviewEventListener:
        self.pull_request_review_listeners[fn.__name__] = fn
        return fn

    @overload
    def listen_for(
        self, event_type: Literal["check_run"]
    ) -> Callable[[CheckRunEventListener], CheckRunEventListener]: ...

    @overload
    def listen_for(
        self, event_type: Literal["check_suite"]
    ) -> Callable[[CheckSuiteEventListener], CheckSuiteEventListener]: ...

    @overload
    def listen_for(
        self, event_type: Literal["comment"]
    ) -> Callable[[CommentEventListener], CommentEventListener]: ...

    @overload
    def listen_for(
        self, event_type: Literal["pull_request"]
    ) -> Callable[[PullRequestEventListener], PullRequestEventListener]: ...

    @overload
    def listen_for(
        self, event_type: Literal["pull_request_review"]
    ) -> Callable[[PullRequestReviewEventListener], PullRequestReviewEventListener]: ...

    def listen_for(self, event_type: str):
        """
        Decorator to register a callback for a specific event type.

        Usage:
            @scm_event_stream.listen_for(event_type="check_run")
            def handle_check_run(event: CheckRunEvent) -> None:
                ...

            @scm_event_stream.listen_for(event_type="check_suite")
            def handle_check_suite(event: CheckSuiteEvent) -> None:
                ...

            @scm_event_stream.listen_for(event_type="comment")
            def handle_comment(event: CommentEvent) -> None:
                ...

            @scm_event_stream.listen_for(event_type="pull_request")
            def handle_pr(event: PullRequestEvent) -> None:
                ...

            @scm_event_stream.listen_for(event_type="pull_request_review")
            def handle_pr_review(event: PullRequestReviewEvent) -> None:
                ...
        """
        if event_type == "check_run":
            return self.listen_for_check_run
        elif event_type == "check_suite":
            return self.listen_for_check_suite
        elif event_type == "comment":
            return self.listen_for_comment
        elif event_type == "pull_request":
            return self.listen_for_pull_request
        elif event_type == "pull_request_review":
            return self.listen_for_pull_request_review
        else:
            raise ValueError(
                f"Invalid event_type: {event_type}. "
                f"Must be 'check_run', 'check_suite', 'comment', 'pull_request', or 'pull_request_review'"
            )


scm_event_stream = SourceCodeManagerEventStream()
"""
The source code manager (SCM) event-stream singleton allows developers to listen to events from SCM
providers such as GitHub and GitLab. Events are mapped into a standard type before being passed to
registered listeners.

Listeners can be registered by using the `listen_for` method on the `scm_event_stream` singleton.

```
@scm_event_stream.listen_for(event_type="check_run")
def handle_check_run(event: CheckRunEvent) -> None:
    ...

@scm_event_stream.listen_for(event_type="check_suite")
def handle_check_suite(event: CheckSuiteEvent) -> None:
    ...

@scm_event_stream.listen_for(event_type="comment")
def handle_comment(event: CommentEvent) -> None:
    ...

@scm_event_stream.listen_for(event_type="pull_request")
def handle_pr(event: PullRequestEvent) -> None:
    ...

@scm_event_stream.listen_for(event_type="pull_request_review")
def handle_pr_review(event: PullRequestReviewEvent) -> None:
    ...
```

When registering listeners it is critical that these listeners are imported into the listeners
module at src/sentry/scm/stream.py. Importing the module registers it with the scm_event_stream
singleton and ensures we can dispatch events to your listener.

Listeners run asynchronously on a task queue; specifically taskbroker. Listeners run in the region
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
