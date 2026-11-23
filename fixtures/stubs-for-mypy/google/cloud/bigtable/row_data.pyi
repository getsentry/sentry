from collections.abc import Callable

class Retry:
    def with_timeout(self, timeout: float) -> Retry: ...
    def with_predicate(self, predicate: Callable[[BaseException], bool]) -> Retry: ...

DEFAULT_RETRY_READ_ROWS: Retry
