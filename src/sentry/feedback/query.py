from datetime import datetime

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Identifier,
    Lambda,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.utils.snuba import raw_snql_query


# TODO: abstract out the reusable parts of this query into helpers (e.g., getting first tuple element, etc.)
def query_top_10_ai_labels_by_feedback_count(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
):
    snuba_request = Request(
        dataset="events",
        app_id="replay-backend-web",
        tenant_ids={"organization_id": organization_id},
        query=Query(
            match=Entity("events"),
            select=[
                Function("count", [], "count"),
                Function(
                    "arrayJoin",
                    parameters=[
                        Function(
                            "arrayMap",
                            parameters=[
                                Lambda(
                                    ["tup"],
                                    Function(
                                        "tupleElement",
                                        parameters=[
                                            Identifier("tup"),
                                            2,
                                        ],
                                    ),
                                ),
                                Function(
                                    "arrayFilter",
                                    parameters=[
                                        Lambda(
                                            ["tup"],
                                            Function(
                                                "startsWith",  # Checks if the tag's key starts with "foo"
                                                parameters=[
                                                    Function(
                                                        "tupleElement",
                                                        parameters=[
                                                            Identifier("tup"),
                                                            1,
                                                        ],  # Returns the first tuple element (tag's key)
                                                    ),
                                                    "ai_categorization.label",
                                                ],
                                            ),
                                        ),
                                        Function(
                                            "arrayZip",
                                            parameters=[
                                                Column("tags.key"),
                                                Column("tags.value"),
                                            ],
                                        ),
                                    ],
                                ),
                            ],
                        )
                    ],
                    alias="tag_value",
                ),
            ],
            where=[
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("project_id"), Op.IN, project_ids),
            ],
            groupby=[  # XXX: Grouped by an alias defined in select, is this ok?
                Column("tag_value"),
            ],
            orderby=[OrderBy(Column("count"), Direction.DESC)],
            limit=Limit(10),
        ),
    )

    return raw_snql_query(
        snuba_request,
        referrer="feedback.query.query_top_10_ai_labels_by_feedback_count",
        use_cache=True,
    )
