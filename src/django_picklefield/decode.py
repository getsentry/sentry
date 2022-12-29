from base64 import b64decode
from pickle import loads
from typing import Any
from zlib import decompress


def dbsafe_decode(value: Any, compress_object: bool = False) -> Any:
    value = value.encode()  # encode str to bytes
    value = b64decode(value)
    if compress_object:
        value = decompress(value)
    return loads(value)
