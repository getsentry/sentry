from __future__ import annotations

import time
import urllib.request
from typing import IO


def urlopen_with_retries(url: str, timeout: int = 5, retries: int = 10) -> IO[bytes]:
    for i in range(retries):
        try:
            return urllib.request.urlopen(url, timeout=timeout)
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(i * 0.01)
    else:
        raise AssertionError("unreachable")
