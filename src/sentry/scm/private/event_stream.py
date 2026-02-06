import inspect
from collections import defaultdict
from collections.abc import Callable
from types import UnionType
from typing import DefaultDict, Union, get_args, get_origin, get_type_hints

from sentry.scm.types import PullRequest

EventType = PullRequest


def union_members(tp: type) -> set[type]:
    origin = get_origin(tp)
    return set(get_args(tp)) if origin is Union or origin is UnionType else {tp}


def is_event_type(tp: type):
    return union_members(tp) <= union_members(EventType)


class SourceCodeManagerEventStream:

    def __init__(self):
        self.__listeners: DefaultDict[type[EventType], list[Callable[[EventType], None]]] = (
            defaultdict(list)
        )

    def listen(self, fn: Callable[[EventType], None]) -> Callable[[EventType], None]:
        """
        Event type.
        """
        type_hints = get_type_hints(fn)
        params = list(inspect.signature(fn).parameters.keys())

        if not params or len(params) > 1:
            raise TypeError(f"{fn.__name__} must have one parameter")
        if params[0] not in type_hints:
            raise TypeError(f"{fn.__name__} must have a type hint on its first parameter")
        if not is_event_type(type_hints[params[0]]):
            raise TypeError(f"{fn.__name__} must accept one of these types {str(EventType)}")

        event_types = union_members(type_hints[params[0]])
        for event_type in event_types:
            self.__listeners[event_type].append(fn)

        return fn


scm_event_stream = SourceCodeManagerEventStream()
"""
The source code manager (SCM) event-stream singleton allows developers to listen to events from SCM
providers such as GitHub and GitLab. Events are mapped into a standard type before being passed to
registered listeners.

Listeners can be registered by using the `listen` method on the `scm_event_stream` singleton.

```
@scm_event_stream
def process_event(event: PullRequestEvent) -> None:
    # Your custom processing logic goes here.
    ...
```

The event your listener will listen for is determined by the type hint specified in the signature.
Only type hints belonging to the `EventType` union may be used. If you wish to listen to more than
one event type you must define a new function which listens for that type. We do not support type
unions at this time.

When registering listeners it is critcal that these listeners are imported into the listeners
module at src/sentry/scm/listeners.py. Importing the module registers it with the scm_event_stream
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
