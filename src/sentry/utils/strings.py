import base64
import zlib


def truncatechars(value, arg):
    """
    Truncates a string after a certain number of chars.

    Argument: Number of chars to truncate after.
    """
    try:
        length = int(arg)
    except ValueError:  # Invalid literal for int().
        return value  # Fail silently.
    if len(value) > length:
        return value[:length] + '...'
    return value


def compress(value):
    return base64.b64encode(zlib.compress(value))


def decompress(value):
    return zlib.decompress(base64.b64decode(value))


def gunzip(value):
    return zlib.decompress(value, 16 + zlib.MAX_WBITS)
