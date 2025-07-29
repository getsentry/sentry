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

from sentry.feedback.usecases.label_generation import AI_LABEL_TAG_PREFIX
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query


# TODO: abstract out the reusable parts of this query into helpers (e.g., getting first tuple element, etc.)
# And do we need to add a filter so its only feedback types that are counted? how to do...
# This seems to work (at least locally), with real ingested feedbacks, but changing the dataset to events doesn't work. Why? It worked in testing when I ran factory's store_event and queried the event dataset.
# Maybe store_event is not representative of how create_feedback_event works?
def query_top_10_ai_labels_by_feedback_count(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
):
    """
    Query the top 10 AI-generated labels by feedback count.
    """

    dataset = Dataset.IssuePlatform

    snuba_request = Request(
        dataset=dataset.value,
        app_id="replay-backend-web",
        tenant_ids={"organization_id": organization_id},
        query=Query(
            match=Entity(dataset.value),
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
                                                "startsWith",  # Checks if the tag's key starts with the correct AI label prefix
                                                parameters=[
                                                    Function(
                                                        "tupleElement",
                                                        parameters=[
                                                            Identifier("tup"),
                                                            1,
                                                        ],  # Returns the first tuple element (tag's key)
                                                    ),
                                                    AI_LABEL_TAG_PREFIX,
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
        referrer="api.organization-issue-replay-count",  # TODO: Change this
        use_cache=True,
    )
