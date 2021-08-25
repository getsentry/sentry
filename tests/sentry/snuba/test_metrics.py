from django.utils.datastructures import MultiValueDict
from snuba_sdk import And, Column, Condition, Entity, Granularity, Limit, Offset, Op, Or, Query

from sentry.snuba.metrics import MAX_POINTS, QueryDefinition, SnubaQueryBuilder


def test_build_snuba_query():

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
                "max(session.duration)",
            ],
        }
    )
    query_definition = QueryDefinition(query_params)
    snuba_queries = SnubaQueryBuilder(1, query_definition).get_snuba_queries()

    assert snuba_queries[0] == Query(
        dataset="metrics",
        match=Entity("metrics_counters"),
        select=[Column("value")],
        groupby=[Column("tags[8]"), Column("tags[2]")],
        where=[Condition(Column("tags[6]"), Op.EQ, 10)],
        limit=Limit(MAX_POINTS),
        offset=Offset(0),
        granularity=Granularity(query_definition.rollup),
    )

    # TODO: test other queries
