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


def _get_ai_labels_from_tags(alias: str | None = None):
    return Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["tup"],
                Function(
                    "tupleElement",
                    parameters=[
                        Identifier("tup"),
                        2,  # Gets the second tuple element (tag's value)
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
        **(
            {"alias": alias} if alias is not None else {}
        ),  # If alias is not None, set the alias of the function
    )


# TODO: abstract out the reusable parts of this query into helpers (e.g., getting first tuple element, etc.)
# And do we need to add a filter so its only feedback types that are counted? how to do...
# This seems to work (at least locally), with real ingested feedbacks, but changing the dataset to events doesn't work. Why? It worked in testing when I ran factory's store_event and queried the event dataset.
# Maybe store_event is not representative of how create_feedback_event works?
def query_top_ai_labels_by_feedback_count(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    count: int,
):
    """
    Query the top `count` AI-generated labels by feedback count.

    To get labels, this zips the keys and values together, filters the tuples to only include those whose key starts with the correct AI label prefix, and then maps the tuples to their values (second tuple element).
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
                        _get_ai_labels_from_tags(),
                    ],
                    alias="tags_value",
                ),
            ],
            where=[
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("project_id"), Op.IN, project_ids),
            ],
            groupby=[  # XXX: Grouped by an alias defined in select, is this ok?
                Column("tags_value"),
            ],
            orderby=[OrderBy(Column("count"), Direction.DESC)],
            limit=Limit(count),
        ),
    )

    return raw_snql_query(
        snuba_request,
        referrer="api.organization-issue-replay-count",  # TODO: Change this
        use_cache=True,
    )


def query_recent_feedbacks_with_ai_labels(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    count: int,
):
    """
    Query the most recent `count` feedbacks, along with their AI labels.

    To get labels, this one does the same thing as the query_top_ai_labels_by_feedback_count query.
    To get the message, it zips the context keys and values together, filters the tuples to only include those whose key is equal to feedback.message, and then maps the tuples to their values (second tuple element).
    """

    dataset = Dataset.IssuePlatform

    snuba_request = Request(
        dataset=dataset.value,
        app_id="replay-backend-web",
        tenant_ids={"organization_id": organization_id},
        query=Query(
            match=Entity(dataset.value),
            select=[
                # XXX: Should we include the event_id?
                # This function is completely copied from the above query, so we should abstract it out (it gets all tag values whose key starts with the correct AI label prefix, so all the AI labels)
                _get_ai_labels_from_tags(alias="labels"),
                Function(
                    "tupleElement",
                    parameters=[
                        Function(
                            "arrayFirst",
                            parameters=[
                                Lambda(
                                    ["tup"],
                                    Function(
                                        "equals",
                                        parameters=[
                                            Function(
                                                "tupleElement",
                                                parameters=[
                                                    Identifier("tup"),
                                                    1,  # Ensure the key is equal to feedback.message
                                                ],
                                            ),
                                            "feedback.message",
                                        ],
                                    ),
                                ),
                                Function(
                                    "arrayZip",
                                    parameters=[
                                        Column("contexts.key"),
                                        Column("contexts.value"),
                                    ],
                                ),
                            ],
                        ),
                        2,  # Gets the second tuple element (tag's value, so the feedback message)
                    ],
                    alias="feedback",
                ),
            ],
            where=[
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("project_id"), Op.IN, project_ids),
                # Ensure that it has at least one AI-generated label
                Condition(
                    Function(
                        "arrayExists",
                        parameters=[
                            Lambda(
                                ["val"],
                                Function(
                                    "startsWith",
                                    parameters=[
                                        Identifier("val"),
                                        AI_LABEL_TAG_PREFIX,
                                    ],
                                ),
                            ),
                            Column("tags.key"),
                        ],
                    ),
                    Op.EQ,
                    1,
                ),
                # Should we also have a condition that ensures that it is a feedback? Like checking that it has a feedback message or something?
            ],
            orderby=[OrderBy(Column("timestamp"), Direction.DESC)],
            limit=Limit(count),
        ),
    )

    return raw_snql_query(
        snuba_request,
        referrer="api.organization-issue-replay-count",  # TODO: Change this
        use_cache=True,
    )


def query_given_labels_by_feedback_count(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    # Order matters here, the columns will be based on the order of the label groups
    labels_groups: list[list[str]],
):
    """
    Query how many feedbacks are in each of the given `labels_groups`.

    We can't count feedbacks in each label individually then group in the application layer, because feedbacks can have multiple labels.
    """

    # Creates a countIf for each label group
    count_ifs = []
    for i, label_group in enumerate(labels_groups):
        count_ifs.append(
            Function(
                "countIf",
                parameters=[
                    Function(
                        "arrayExists",  # Checks that some label is in the label group, and if it is, counts the current feedback
                        parameters=[
                            Lambda(
                                ["val"],
                                Function(
                                    "in",
                                    parameters=[
                                        Identifier("val"),
                                        label_group,
                                    ],
                                ),
                            ),
                            _get_ai_labels_from_tags(alias="labels"),
                        ],
                    )
                ],
                alias=f"count_if_{i}",
            )
        )

    dataset = Dataset.IssuePlatform

    snuba_request = Request(
        dataset=dataset.value,
        app_id="replay-backend-web",
        tenant_ids={"organization_id": organization_id},
        query=Query(
            match=Entity(dataset.value),
            select=[
                # Counts the number of feedbacks in each label group
                *count_ifs,
            ],
            where=[
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("project_id"), Op.IN, project_ids),
            ],
        ),
    )

    return raw_snql_query(
        snuba_request,
        referrer="api.organization-issue-replay-count",  # TODO: Change this
        use_cache=True,
    )
