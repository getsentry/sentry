from typing import Callable, Optional, Sequence


def initialize_consumer_state(callables: Optional[Sequence[Callable]] = None) -> None:
    """
    Initialization function for subprocesses spawned by consumers that use Django.

    It initializes the Sentry Django app from scratch to avoid multiprocessing issues.

    Accepts an optional list of callables that will be run after configuring Django
    """
    from sentry.runner import configure

    configure()

    if callables:
        for callable in callables:
            callable()
