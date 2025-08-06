from collections.abc import Mapping
from datetime import datetime
from typing import Any

import sentry_sdk
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
from sentry.utils.snuba import RateLimitExceeded, raw_snql_query


def execute_query(query: Query, tenant_id: dict[str, int], referrer: str) -> Mapping[str, Any]:
    dataset = Dataset.IssuePlatform

    # XXX: pattern-matched from replay/usecases/query/__init__.py
    try:
        return raw_snql_query(
            Request(
                dataset=dataset.value,
                app_id="feedback-backend-web",  # XXX: Is this right?
                query=query,
                tenant_ids=tenant_id,
            ),
            referrer,
        )
    except RateLimitExceeded as exc:
        sentry_sdk.set_tag("feedback-rate-limit-exceeded", True)
        sentry_sdk.set_tag("org_id", tenant_id.get("organization_id"))
        sentry_sdk.set_extra("referrer", referrer)
        sentry_sdk.capture_exception(exc)
        raise


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
    count: int,
):
    """
    Query the top `count` AI-generated labels by feedback count.

    This is done by arrayJoin-ing the AI label values then grouping by the label values.
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
                alias="tags_value",
            ),
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
        ],
        groupby=[  # XXX: Grouped by an alias defined in select, is this ok?
            Column("tags_value"),
        ],
        orderby=[OrderBy(Column("count"), Direction.DESC)],
        limit=Limit(count),
    )

    return execute_query(
        snuba_query,
        {"organization_id": organization_id},
        "feedbacks.query.top_ai_labels_by_feedback_count",
    )["data"]


def query_recent_feedbacks_with_ai_labels(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    count: int,
):
    """
    Query the most recent `count` feedbacks, along with their AI labels. Ensures feedbacks have at least one AI label.

    To get the message, it zips the context keys and values together, filters the tuples to only include those whose key is equal to feedback.message, and then maps the tuples to their values (second tuple element).
    """

    dataset = Dataset.IssuePlatform

    snuba_query = Query(
        match=Entity(dataset.value),
        select=[
            _get_ai_labels_from_tags(alias="labels"),
            # Gets feedback message from contexts
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
        limit=Limit(count),
    )

    return execute_query(
        snuba_query,
        {"organization_id": organization_id},
        "feedbacks.query.recent_feedbacks_with_ai_labels",
    )["data"]


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

    # Raise an error since we need at least one select for a query to be valid
    if not labels_groups:
        raise ValueError("labels_groups cannot be empty")

    # Creates a countIf for each label group
    count_ifs = []
    for i, label_group in enumerate(labels_groups):
        count_ifs.append(
            # Checks that some label is in the label group, and if it is, counts the current feedback
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
            # Counts the number of feedbacks in each label group
            *count_ifs,
        ],
        where=[
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("occurrence_type_id"), Op.EQ, FeedbackGroup.type_id),
        ],
    )

    return execute_query(
        snuba_query,
        {"organization_id": organization_id},
        "feedbacks.query.given_labels_by_feedback_count",
    )["data"]
