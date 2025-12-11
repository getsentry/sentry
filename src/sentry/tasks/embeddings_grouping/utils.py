import time


# Marked as internal with underscore but actually used in getsentry
def _retry_operation(operation, *args, retries, delay, exceptions, **kwargs):
    for attempt in range(retries):
        try:
            return operation(*args, **kwargs)
        except exceptions:
            if attempt < retries - 1:
                time.sleep(delay * (2**attempt))
            else:
                raise
