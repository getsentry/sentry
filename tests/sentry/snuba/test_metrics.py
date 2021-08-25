from dataclasses import dataclass
from datetime import datetime
from unittest import mock

import pytz
from django.utils.datastructures import MultiValueDict
from snuba_sdk import And, Column, Condition, Entity, Granularity, Limit, Offset, Op, Or, Query

from sentry.api.bases import organization
from sentry.snuba.metrics import MAX_POINTS, QueryDefinition, SnubaQueryBuilder


@dataclass
class PseudoProject:
    organization_id: int
    id: int


@mock.patch(
    "sentry.snuba.sessions_v2.get_now", return_value=datetime(2021, 8, 25, 17, 59, tzinfo=pytz.utc)
)
def test_build_snuba_query(mock_now):

    # Your typical release health query querying everything
    query_params = MultiValueDict(
        {
            "query": [
                "release:staging"
            ],  # weird release but we need a string exising in mock indexer
            "groupBy": ["session.status", "environment"],
            "field": [
                "sum(session)",
                "count_unique(user)",
                "p95(session.duration)",
            ],
        }
    )
    query_definition = QueryDefinition(query_params)
    snuba_queries = SnubaQueryBuilder(PseudoProject(1, 1), query_definition).get_snuba_queries()

    def expected_query(match, select, extra_groupby):
        return Query(
            dataset="metrics",
            match=Entity(match),
            select=[Column(select)],
            groupby=[Column("tags[8]"), Column("tags[2]")] + extra_groupby,
            where=[
                Condition(Column("org_id"), Op.EQ, 1),
                Condition(Column("project_id"), Op.EQ, 1),
                Condition(Column("metric_id"), Op.IN, [9, 11, 7]),
                Condition(Column("timestamp"), Op.GTE, datetime(2021, 5, 27, 14, tzinfo=pytz.utc)),
                Condition(Column("timestamp"), Op.LT, datetime(2021, 8, 25, 14, tzinfo=pytz.utc)),
                Condition(Column("tags[6]"), Op.EQ, 10),
            ],
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=Granularity(query_definition.rollup),
        )

    assert snuba_queries[0] == expected_query("metrics_counters", "value", [])
    assert snuba_queries[1] == expected_query("metrics_counters", "value", [Column("timestamp")])
    assert snuba_queries[2] == expected_query("metrics_sets", "value", [])
    assert snuba_queries[3] == expected_query("metrics_sets", "value", [Column("timestamp")])
    assert snuba_queries[4] == expected_query("metrics_distributions", "percentiles", [])
    assert snuba_queries[5] == expected_query(
        "metrics_distributions", "percentiles", [Column("timestamp")]
    )
