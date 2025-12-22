from datetime import datetime
from typing import NamedTuple

import sentry_sdk
from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

from sentry.seer.workflows.compare import KeyedValueCount, keyed_kl_score
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query


class Score(NamedTuple):
    key: str
    score: float


@sentry_sdk.trace
def get_suspect_tag_scores(
    org_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    envs: list[str],
    group_id: int,
) -> list[Score]:
    """
    Queries the baseline and outliers sets. Computes the KL scores of each and returns a sorted
    list of key, score values.
    """
    outliers = query_selection_set(org_id, project_id, start, end, envs, group_id=group_id)
    baseline = query_baseline_set(
        org_id, project_id, start, end, envs, tag_keys=[o[0] for o in outliers]
    )

    outliers_count = query_error_counts(org_id, project_id, start, end, envs, group_id=group_id)
    baseline_count = query_error_counts(org_id, project_id, start, end, envs, group_id=None)

    return [
        Score(key=key, score=score)
        for key, score in keyed_kl_score(
            baseline,
            outliers,
            total_baseline=baseline_count,
            total_outliers=outliers_count,
        )
    ]


@sentry_sdk.trace
def query_baseline_set(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    tag_keys: list[str],
) -> list[KeyedValueCount]:
    """
    Query for the count of unique tag-key, tag-value pairings for a set of tag keys.

    SQL:
        SELECT arrayJoin(arrayZip(tags.key, tags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            has({tag_keys}, tupleElement(variants, 1)) = 1
        )
        GROUP BY variants
    """
    where = []
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function(
                "arrayJoin",
                parameters=[
                    Function(
                        "arrayZip",
                        parameters=[
                            Column("tags.key"),
                            Column("tags.value"),
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
            Condition(
                Function(
                    "has",
                    parameters=[
                        tag_keys,
                        Function("tupleElement", parameters=[Column("variants"), 1]),
                    ],
                ),
                Op.EQ,
                1,
            ),
            *where,
        ],
        groupby=[Column("variants")],
        limit=Limit(1000),  # Arbitrary upper-bound.
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer=Referrer.ISSUES_SUSPECT_TAGS_QUERY_BASELINE_SET.value,
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], result["count"])
        for result in response["data"]
    ]


@sentry_sdk.trace
def query_selection_set(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int,
) -> list[KeyedValueCount]:
    """
    Query for the count of unique tag-key, tag-value pairings for a given group_id.

    SQL:
        SELECT arrayJoin(arrayZip(tags.key, tags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            group_id = {group_id}
        )
        GROUP BY variants
    """
    where = []
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function(
                "arrayJoin",
                parameters=[
                    Function(
                        "arrayZip",
                        parameters=[
                            Column("tags.key"),
                            Column("tags.value"),
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
            Condition(Column("group_id"), Op.EQ, group_id),
            *where,
        ],
        groupby=[Column("variants")],
        limit=Limit(1000),  # Arbitrary upper-bound.
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer=Referrer.ISSUES_SUSPECT_TAGS_QUERY_SELECTION_SET.value,
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], result["count"])
        for result in response["data"]
    ]


@sentry_sdk.trace
def query_error_counts(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    environments: list[str],
    group_id: int | None,
) -> int:
    """
    Query for the number of errors for a given project optionally associated witha a group_id.

    SQL:
        SELECT count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            environment IN environments AND
            group_id = {group_id}
        )
    """
    where = []
    if group_id is not None:
        where.append(Condition(Column("group_id"), Op.EQ, group_id))
    if environments:
        where.append(Condition(Column("environment"), Op.IN, environments))

    query = Query(
        match=Entity("events"),
        select=[
            Function("count", parameters=[], alias="count"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("timestamp"), Op.GTE, start),
            *where,
        ],
        limit=Limit(1),
    )

    snuba_request = Request(
        dataset="events",
        app_id="issues-backend-web",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )

    response = raw_snql_query(
        snuba_request,
        referrer=Referrer.ISSUES_SUSPECT_TAGS_QUERY_ERROR_COUNTS.value,
        use_cache=True,
    )

    return int(response["data"][0]["count"])
