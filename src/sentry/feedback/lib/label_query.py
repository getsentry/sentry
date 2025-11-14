from typing import int
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
from sentry.issues.grouptype import FeedbackGroup
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query


def _get_ai_labels_from_tags(alias: str | None = None):
    """
    Gets all the AI label values as an array from the tags column.

    It does this by zipping the keys and values together, filtering the tuples to only include those whose key starts with the correct AI label prefix, and then mapping the tuples to their values (second tuple element).
    """

    return Function(
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
                            "startsWith",
                            parameters=[
                                Function(
                                    "tupleElement",
                                    parameters=[
                                        Identifier("tup"),
                                        1,
                                    ],
                                ),
                                f"{AI_LABEL_TAG_PREFIX}.label.",
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
        **({"alias": alias} if alias is not None else {}),
    )


def query_top_ai_labels_by_feedback_count(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    limit: int,
):
    """
    Query the top `limit` AI-generated labels by feedback count.

    This is done by arrayJoin-ing the AI label values then grouping by the label values.

    The return format is:
    [
        {
            "label": str,
            "count": int,
        },
        ...
    ]
    """

    dataset = Dataset.IssuePlatform

    snuba_query = Query(
        match=Entity(dataset.value),
        select=[
            Function("count", [], "count"),
            Function(
                "arrayJoin",
                parameters=[
                    _get_ai_labels_from_tags(),
                ],
                alias="label",
            ),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
        ],
        groupby=[
            Column("label"),
        ],
        orderby=[OrderBy(Column("count"), Direction.DESC)],
        limit=Limit(limit),
    )

    return raw_snql_query(
        Request(
            dataset=dataset.value,
            app_id="feedback-backend-web",
            query=snuba_query,
            tenant_ids={"organization_id": organization_id},
        ),
        referrer="feedbacks.label_query",
    )["data"]


def query_recent_feedbacks_with_ai_labels(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    limit: int,
):
    """
    Query the most recent `limit` feedbacks, along with their AI labels. Ensures feedbacks have at least one AI label.

    To get the message, it zips the context keys and values together, filters the tuples to only include those whose key is equal to feedback.message, and then maps the tuples to their values (second tuple element).

    The return format is:
    [
        {
            "labels": list[str],
            "feedback": str,
        },
        ...
    ]
    """

    dataset = Dataset.IssuePlatform

    snuba_query = Query(
        match=Entity(dataset.value),
        select=[
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
                                                1,
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
                    2,
                ],
                alias="feedback",
            ),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
            # Ensure that there is at least one AI-generated label
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
                                    f"{AI_LABEL_TAG_PREFIX}.label.",
                                ],
                            ),
                        ),
                        Column("tags.key"),
                    ],
                ),
                Op.EQ,
                1,
            ),
        ],
        orderby=[OrderBy(Column("timestamp"), Direction.DESC)],
        limit=Limit(limit),
    )

    return raw_snql_query(
        Request(
            dataset=dataset.value,
            app_id="feedback-backend-web",
            query=snuba_query,
            tenant_ids={"organization_id": organization_id},
        ),
        referrer="feedbacks.label_query",
    )["data"]


def query_label_group_counts(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    labels_groups: list[list[str]],
):
    """
    Query how many feedbacks are in each of the given `labels_groups`.

    We can't count feedbacks in each label individually then group in the application layer, because feedbacks can have multiple labels.

    The return format is a list of integers, representing the number of feedbacks in each label group (in the order of the label groups).
    """

    if not labels_groups:
        raise ValueError("labels_groups cannot be empty")

    count_ifs = []
    for i, label_group in enumerate(labels_groups):
        count_ifs.append(
            Function(
                "countIf",
                parameters=[
                    Function(
                        "arrayExists",
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

    snuba_query = Query(
        match=Entity(dataset.value),
        select=[
            *count_ifs,
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
        ],
    )

    raw_response = raw_snql_query(
        Request(
            dataset=dataset.value,
            app_id="feedback-backend-web",
            query=snuba_query,
            tenant_ids={"organization_id": organization_id},
        ),
        referrer="feedbacks.label_query",
    )["data"]

    return [raw_response[0][f"count_if_{i}"] for i in range(len(labels_groups))]
