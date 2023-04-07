def initialize_consumer_state() -> None:
    """
    Initialization function for subprocesses spawned by consumers that use Django.

    It initializes the Sentry Django app from scratch to avoid multiprocessing issues.
    """
    from sentry.runner import configure

    configure()
