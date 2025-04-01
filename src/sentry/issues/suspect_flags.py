from datetime import datetime

from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry.seer.workflows.compare import KeyedValueCount, Score, keyed_kl_score
from sentry.utils.snuba import raw_snql_query


def get_suspect_flag_scores(
    org_id: int, project_id: int, start: datetime, end: datetime, group_id: int
) -> list[Score]:
    """
    Queries the baseline and outliers sets. Computes the KL scores of each and returns a sorted
    list of key, score values.
    """
    baseline = query_flag_rows(org_id, project_id, start, end, group_id=None)
    outliers = query_flag_rows(org_id, project_id, start, end, group_id=group_id)
    return keyed_kl_score(baseline, outliers)


def query_flag_rows(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    group_id: int | None,
) -> list[KeyedValueCount]:
    """
    Query for the count of unique flag-key, flag-value pairings. Specifying a group-id will
    narrow the query to a particular issue.

    SQL:
        SELECT arrayJoin(arrayZip(flags.key, flags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            group_id = {group_id}
        )
        GROUP BY variants
    """
    where = []
    if group_id is not None:
        where.append(Condition(Column("group_id"), Op.EQ, group_id))

    query = Query(
        match=Entity("events"),
        select=[
            Function(
                "arrayJoin",
                parameters=[
                    Function(
                        "arrayZip",
                        parameters=[
                            Column("flags.key"),
                            Column("flags.value"),
                        ],
                    ),
                ],
                alias="variants",
            ),
            Function("count", parameters=[], alias="count"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            *where,
        ],
        groupby=[Column("variants")],
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer="issues.distribution.suspect_flags_ranking",
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], result["count"])
        for result in response["data"]
    ]
