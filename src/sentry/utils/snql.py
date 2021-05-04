import random
from typing import List, Mapping, NamedTuple, Optional, Set

from sentry import options


class SNQLOption(NamedTuple):
    entity: str
    dryrun: bool = True


class ReferrerCheck(NamedTuple):
    option: str
    denylist: Set[str]
    allowlist: Set[str]
    prefixes: List[str]
    by_entity: Mapping[str, str]
    is_dryrun: bool = True

    def get_option(self, referrer: Optional[str]) -> Optional[SNQLOption]:
        if not referrer or referrer in self.denylist:
            return None

        use_snql = False
        entity = "auto"
        if referrer in self.allowlist:
            use_snql = True
        elif referrer in self.by_entity:
            use_snql = True
            entity = self.by_entity[referrer]
        else:
            for prefix in self.prefixes:
                if referrer.startswith(prefix):
                    use_snql = True
                    break

        if use_snql:
            snql_rate = options.get(self.option)
            assert isinstance(snql_rate, float)
            if random.random() <= snql_rate:
                return SNQLOption(entity, self.is_dryrun)

        return None


dryrun_check = ReferrerCheck(
    option="snuba.snql.referrer-rate",
    denylist={
        "tsdb-modelid:4",
        "tsdb-modelid:300",
        "tsdb-modelid:200",
        "tsdb-modelid:202",
        "tsdb-modelid:100",
        "eventstore.get_next_or_prev_event_id",
        "tagstore.get_tag_value_paginator_for_projects",
    },
    allowlist=set(),
    prefixes=[
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
    ],
    by_entity={
        "api.performance.durationpercentilechart": "discover_transactions",
        "api.performance.vital-detail": "discover_transactions",
        "api.performance.status-breakdown": "discover_transactions",
        "api.trends.get-percentage-change": "discover_transactions",
        "api.performance.transaction-summary": "discover_transactions",
    },
)

snql_check = ReferrerCheck(
    option="snuba.snql.snql_only",
    denylist=set(),
    allowlist={"sessions.stability-sort"},
    prefixes=[],
    by_entity={},
    is_dryrun=False,
)


def should_use_snql(referrer: Optional[str]) -> Optional[SNQLOption]:
    snql_option = snql_check.get_option(referrer)
    if snql_option:
        return snql_option

    return dryrun_check.get_option(referrer)
