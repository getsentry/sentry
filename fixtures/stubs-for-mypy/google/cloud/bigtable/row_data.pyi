class Retry:
    def with_timeout(self, timeout: float) -> Retry: ...

DEFAULT_RETRY_READ_ROWS: Retry
