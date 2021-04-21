import random
from typing import Optional, Set

from sentry import options

referrer_blacklist: Set[str] = set()
referrers_by_entity = {
    "api.performance.durationpercentilechart": "discover_transactions",
    "api.performance.vital-detail": "discover_transactions",
    "api.performance.status-breakdown": "discover_transactions",
    "api.trends.get-percentage-change": "discover_transactions",
    "api.performance.transaction-summary": "discover_transactions",
}
referrer_prefixes = ["outcomes.", "sessions.", "tsdb-modelid:6", "tsdb-modelid:5", "incidents."]
referrers = {
    "eventstore.get_events",
    "group.filter_by_event_id",
    "incidents.get_incident_aggregates",
    "tagstore.get_tag_value_paginator_for_projects",
    "api.serializer.projects.get_stats",
    "tsdb-modelid:407",
    "testing.test",
}


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
