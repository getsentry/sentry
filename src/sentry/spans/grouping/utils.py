import re
from hashlib import md5
from typing import Optional, Sequence

from django.utils.encoding import force_bytes

_fingerprint_var_re = re.compile(r"\{\{\s*(\S+)\s*\}\}")


def parse_fingerprint_var(value: str) -> Optional[str]:
    match = _fingerprint_var_re.match(value)
    if match is not None and match.end() == len(value):
        return match.group(1)
    return None


class Hash:
    def __init__(self) -> None:
        self.result = md5()

    def update(self, values: Sequence[str]) -> "Hash":
        for value in values:
            self.result.update(force_bytes(value, errors="replace"))
        return self

    def hexdigest(self) -> str:
        # Just want a 64 bit digest, so take
        # the first 16 chars of the hexdigest
        return self.result.hexdigest()[:16]


def hash_values(values: Sequence[str]) -> str:
    return Hash().update(values).hexdigest()
