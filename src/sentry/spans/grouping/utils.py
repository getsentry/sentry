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

    def update(self, values: Sequence[str]) -> None:
        for value in values:
            self.result.update(force_bytes(value, errors="replace"))

    def hexdigest(self) -> str:
        return self.result.hexdigest()


def hash_values(values: Sequence[str]) -> str:
    hash_ = Hash()
    hash_.update(values)
    return hash_.hexdigest()
