import random
from typing import Optional, Set

from sentry import options

referrer_blacklist = {
    "tsdb-modelid:4",
    "tsdb-modelid:300",
    "tsdb-modelid:200",
    "tsdb-modelid:202",
    "tsdb-modelid:100",
    "eventstore.get_next_or_prev_event_id",
}
referrers_by_entity = {
    "api.performance.durationpercentilechart": "discover_transactions",
    "api.performance.vital-detail": "discover_transactions",
    "api.performance.status-breakdown": "discover_transactions",
    "api.trends.get-percentage-change": "discover_transactions",
    "api.performance.transaction-summary": "discover_transactions",
}
referrer_prefixes = [
    "outcomes.",
    "sessions.",
    "tsdb-modelid:",
    "incidents.",
    "tagstore.",
    "group.",
    "search.",
    "serializers.",
    "eventstore.",
    "search_sample.",
    "testing.test",
]
referrers: Set[str] = set()


# Returns None (do not use SnQL), "auto" (use dataset as entity) or a specific entity to use.
def should_use_snql(referrer: Optional[str]) -> Optional[str]:
    if not referrer or referrer in referrer_blacklist:
        return None

    use_snql = False
    entity = "auto"
    if referrer in referrers:
        use_snql = True
    elif referrer in referrers_by_entity:
        use_snql = True
        entity = referrers_by_entity[referrer]
    else:
        for prefix in referrer_prefixes:
            if referrer.startswith(prefix):
                use_snql = True
                break

    if use_snql:
        snql_rate = options.get("snuba.snql.referrer-rate")
        assert isinstance(snql_rate, float)
        if random.random() <= snql_rate:
            return entity

    return None
