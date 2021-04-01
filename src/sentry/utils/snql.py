import random
from typing import Optional

from sentry import options

snql_referrers = {"sessions.stability-sort"}


def should_use_snql(referrer: Optional[str]) -> bool:
    if referrer in snql_referrers:
        use_snql = options.get("snuba.snql.referrer-rate")
        assert isinstance(use_snql, float)
        return random.random() <= use_snql

    return False
