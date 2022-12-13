from typing import Any, Dict, Sequence

from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.types.issues import GroupCategory

"""
Issue category specific components to computing a preview for a set of rules.

To add support for a new issue category/dataset:
    1. Add mapping from GroupCategory to Dataset
    2. Add mapping from Dataset to snuba column name
        a. The column name should be a field in sentry.snuba.events.Column
    3. Add category-specific query params for UPDATE_KWARGS_FOR_GROUPS and UPDATE_KWARGS_FOR_GROUP
"""

# Maps group category to dataset
GROUP_CATEGORY_TO_DATASET: Dict[GroupCategory, Dataset] = {
    GroupCategory.ERROR: Dataset.Events,
    GroupCategory.PERFORMANCE: Dataset.Transactions,
}

# Maps datasets to snuba column name
DATASET_TO_COLUMN_NAME: Dict[Dataset, str] = {
    Dataset.Events: "event_name",
    Dataset.Transactions: "transaction_name",
}


# Given a list of Column Enum objects, return their actual column name in each dataset that is supported
def get_dataset_columns(columns: Sequence[Columns]) -> Dict[Dataset, Sequence[str]]:
    dataset_columns: Dict[Dataset, Sequence[str]] = {}
    for dataset, column_name in DATASET_TO_COLUMN_NAME.items():
        dataset_columns[dataset] = [
            getattr(column.value, column_name)
            for column in columns
            if getattr(column.value, column_name) is not None
        ]

    return dataset_columns


def _events_from_groups_kwargs(
    group_ids: Sequence[int], kwargs: Dict[str, Any], has_issue_state_condition: bool = True
) -> Dict[str, Any]:
    if has_issue_state_condition:
        kwargs["conditions"] = [("group_id", "IN", group_ids)]
    return kwargs


def _transactions_from_groups_kwargs(
    group_ids: Sequence[int], kwargs: Dict[str, Any], has_issue_state_condition: bool = True
) -> Dict[str, Any]:
    if has_issue_state_condition:
        kwargs["having"] = [("group_id", "IN", group_ids)]
        kwargs["conditions"] = [[["hasAny", ["group_ids", ["array", group_ids]]], "=", 1]]
    if "aggregations" not in kwargs:
        kwargs["aggregations"] = []
    kwargs["aggregations"].append(("arrayJoin", ["group_ids"], "group_id"))
    return kwargs


"""
Returns the rows that contain the group id.
If there's a many-to-many relationship, the group id column should be arrayjoined.
If there are no issue state changes (causes no group ids), then do not filter by group ids.
"""
UPDATE_KWARGS_FOR_GROUPS = {
    Dataset.Events: _events_from_groups_kwargs,
    Dataset.Transactions: _transactions_from_groups_kwargs,
}


def _events_from_group_kwargs(group_id: int, kwargs: Dict[str, Any]) -> Dict[str, Any]:
    kwargs["conditions"] = [("group_id", "=", group_id)]
    return kwargs


def _transactions_from_group_kwargs(group_id: int, kwargs: Dict[str, Any]) -> Dict[str, Any]:
    kwargs["conditions"] = [[["has", ["group_ids", group_id]], "=", 1]]
    return kwargs


"""
Returns the rows that reference the group id without arrayjoining.
"""
UPDATE_KWARGS_FOR_GROUP = {
    Dataset.Events: _events_from_group_kwargs,
    Dataset.Transactions: _transactions_from_group_kwargs,
}
