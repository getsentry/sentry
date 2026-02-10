from collections.abc import Callable

from sentry.scm.types import CheckRunEvent, CommentEvent, PullRequestEvent

type CheckRunEventListener = Callable[[CheckRunEvent], None]
type CommentEventListener = Callable[[CommentEvent], None]
type PullRequestEventListener = Callable[[PullRequestEvent], None]


class SourceCodeManagerEventStream:

    def __init__(self):
        self.check_run_listeners: dict[str, CheckRunEventListener] = {}
        self.comment_listeners: dict[str, CommentEventListener] = {}
        self.pull_request_listeners: dict[str, PullRequestEventListener] = {}

    def listen_for_check_run(self, fn: CheckRunEventListener) -> CheckRunEventListener:
        self.check_run_listeners[fn.__name__] = fn
        return fn

    def listen_for_comment(self, fn: CommentEventListener) -> CommentEventListener:
        self.comment_listeners[fn.__name__] = fn
        return fn

    def listen_for_pull_request(self, fn: PullRequestEventListener) -> PullRequestEventListener:
        self.pull_request_listeners[fn.__name__] = fn
        return fn


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
