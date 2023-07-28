import sentry_sdk


def size_in_mb(string: str) -> int:
    """
    Computes the size of a string in MB.
    """
    try:
        size_in_bytes = len(string.encode())
        return int(size_in_bytes / 1024 / 1024)
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return 0
