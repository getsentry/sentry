from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime

from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request

from sentry.seer.workflows.compare import kl_compare_sets
from sentry.utils.snuba import raw_snql_query

Attributes = Mapping[str, dict[str, float]]
AttributesRow = tuple[str, str, float]
Score = tuple[str, float]


def get_suspect_flag_scores(
    org_id: int, project_id: int, start: datetime, end: datetime, primary_hash: str
) -> list[Score]:
    """
    Queries the baseline and outliers sets. Computes the KL scores of each and returns a sorted
    list of key, score values.
    """
    baseline_rows = query_flag_rows(org_id, project_id, start, end, primary_hash=None)
    baseline = as_attribute_dict(baseline_rows)

    outliers_rows = query_flag_rows(org_id, project_id, start, end, primary_hash=primary_hash)
    outliers = as_attribute_dict(outliers_rows)

    return kl_score(baseline, outliers)


def query_flag_rows(
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
    primary_hash: str | None,
) -> list[AttributesRow]:
    """
    Query for the count of unique flag-key, flag-value pairings. Specifying a primary-hash will
    narrow the query to a particular issue.

    SQL:
        SELECT arrayJoin(arrayZip(flags.key, flags.value)) as variants, count()
        FROM errors_dist
        WHERE (
            project_id = {project_id} AND
            timestamp >= {start} AND
            timestamp < {end} AND
            primary_hash = {primary_hash}
        )
        GROUP BY variants
    """
    where = []
    if primary_hash is not None:
        where.append(Condition(Column("primary_hash"), Op.EQ, primary_hash))

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
        referrer="issues.distribution.flags",
        use_cache=True,
    )

    return [
        (result["variants"][0], result["variants"][1], float(result["count"]))
        for result in response["data"]
    ]


def as_attribute_dict(rows: list[AttributesRow]) -> Attributes:
    """
    Coerce a database result into a standardized type.
    """
    attributes: Mapping[str, dict[str, float]] = defaultdict(dict[str, float])
    for key, value, count in rows:
        attributes[key][value] = count
    return attributes


def kl_score(baseline: Attributes, outliers: Attributes) -> list[Score]:
    """
    Computes the KL scores of each key in the outlier set and returns a sorted list, in descending
    order, of key, score values.
    """
    return sorted(
        (
            (key, kl_compare_sets(baseline[key], outliers[key]))
            for key in outliers
            if key in baseline
        ),
        key=lambda k: k[1],
        reverse=True,
    )
