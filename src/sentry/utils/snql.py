import random
from typing import Optional

from sentry import options


def should_use_snql(referrer: Optional[str]) -> bool:
    snql_rate = options.get("snuba.snql.snql_only")
    if not isinstance(snql_rate, float):
        return False

    if snql_rate == 1.0:
        return True

    return random.random() <= snql_rate
