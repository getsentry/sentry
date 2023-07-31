import sentry_sdk


def size_in_bytes(string: str) -> int:
    """
    Computes the size of a string in MB.
    """
    try:
        return len(string.encode())
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return 0
