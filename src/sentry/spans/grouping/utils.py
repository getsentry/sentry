from hashlib import md5
from typing import Sequence

from django.utils.encoding import force_bytes


def hash_values(values: Sequence[str]) -> str:
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors="replace"))
    return result.hexdigest()
