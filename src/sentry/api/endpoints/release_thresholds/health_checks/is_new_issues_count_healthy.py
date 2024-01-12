from __future__ import annotations

from typing import List
from uuid import uuid4

from django.db.models import CharField, Count, QuerySet, Value

from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.models.group import Group
from sentry.models.release_threshold.constants import ReleaseThresholdType, TriggerType

NEW_ISSUES_COUNT_COLUMN = "count"
NEW_ISSUES_UNIQUE_KEY_COLUMN = "unique_key"


def update_new_issues_count_healthy_for_thresholds(
    release_thresholds: List[EnrichedThreshold],
) -> None:
    """
    Updates the release thresholds is_healthy for the given iterable.
    This function leverages bulk querying to update the values of the release thresholds.
    Each release threshold is considered to be a unique threshold to determine its own health.
    """
    queries = {}
    q = None
    # Loop through each enriched_threshold and get the query that we need to aggregate
    for ethreshold in release_thresholds:
        # Ignore any incorrect thresholds that might have slipped in
        if ethreshold["threshold_type"] != ReleaseThresholdType.NEW_ISSUE_COUNT_STR:
            continue

        unique_id = str(uuid4())
        queries[unique_id] = ethreshold
        annotation = get_is_new_issues_count_healthy_query(ethreshold, unique_id)
        if q is None:
            q = annotation
        else:
            q = q.union(annotation, all=True)

    if q is None:
        return

    # Execute the query to retrieve the unique_key and count columns that hold the data we need
    # Each resultant threshold should be a dictionary with the 2 columns
    results = q.values(NEW_ISSUES_UNIQUE_KEY_COLUMN, NEW_ISSUES_COUNT_COLUMN)

    # Update the enriched_thresholds with the results
    for result in results:
        unique_key = result[
            NEW_ISSUES_UNIQUE_KEY_COLUMN
        ]  # Get the unique key from the result dictionary
        value = result[NEW_ISSUES_COUNT_COLUMN]  # Get the count value
        ethreshold = queries[unique_key]
        is_healthy = is_new_issues_count_healthy(enriched_threshold=ethreshold, new_issues=value)

        ethreshold.update({"is_healthy": is_healthy})


def get_is_new_issues_count_healthy_query(
    release_threshold: EnrichedThreshold, unique_key: str
) -> QuerySet:
    """
    Return a queryset that contains the count of new issues for this specific release threshold.
    It will group by the unique key.
    The expectation is for the caller to only have to use the `unique_key` and `count` fields.
    The reason for this function is to help bulk query the results to the datastore and prevent N+1 queries.
    """
    release_id = release_threshold["release_id"]
    project_id = release_threshold["project_id"]
    time_range = (release_threshold["start"], release_threshold["end"])

    query = Group.objects.filter(
        project__id=project_id, first_release__id=release_id, first_seen__range=time_range
    )

    if release_threshold["environment"]:
        query = query.filter(
            groupenvironment__environment__id=release_threshold["environment"]["id"],
        )

    # Annotate the queryset with the count and a unique key
    # The unique key is used to group all the rows together for the full count.
    query = (
        query.annotate(unique_key=Value(unique_key, output_field=CharField()))
        .values(NEW_ISSUES_UNIQUE_KEY_COLUMN)
        .annotate(count=Count("*"))
    )
    return query


def is_new_issues_count_healthy(enriched_threshold: EnrichedThreshold, new_issues: int) -> bool:
    baseline_value = enriched_threshold["value"]
    if enriched_threshold["trigger_type"] == TriggerType.OVER_STR:
        # If new issues is under/equal the threshold value, then it is healthy
        return new_issues <= baseline_value
    # Else, if new issues is over/equal the threshold value, then it is healthy
    return new_issues >= baseline_value
