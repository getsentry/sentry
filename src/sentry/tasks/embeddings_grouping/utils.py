import time
from collections.abc import Callable


# Marked as internal with underscore but actually used in getsentry
def _retry_operation[R](
    operation: Callable[..., R],
    *args: object,
    retries: int,
    delay: float,
    exceptions: type[BaseException] | tuple[type[BaseException], ...],
    **kwargs: object,
) -> R | None:
    for attempt in range(retries):
        try:
            return operation(*args, **kwargs)
        except exceptions:
            if attempt < retries - 1:
                time.sleep(delay * (2**attempt))
            else:
                raise
    return None
