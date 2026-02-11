from __future__ import annotations

import time
import urllib.request
from typing import IO


def urlopen_with_retries(url: str, timeout: int = 5, retries: int = 6) -> IO[bytes]:
    """
    Retries with exponential backoff.
    Assuming default parameters (5s timeout, 6 retries), waits for a maximum of
    (5 + 2^0) + (5 + 2^1) + ... + (5 + 2^4) + (5) = 61s.
            raises on the last one so no sleep ^
    """
    for i in range(retries):
        try:
            return urllib.request.urlopen(url, timeout=timeout)
        except Exception:
            if i == retries - 1:
                raise
            print(f"Failed to fetch {url}, attempting retry {i + 1}")
            time.sleep(2**i)  # 1, 2, 4, ..., 16
    else:
        raise AssertionError("unreachable")
