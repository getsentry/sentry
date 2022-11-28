from typing import Any, Dict, Sequence

from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Column
from sentry.types.issues import GroupCategory

"""
Issue category specific components to computing a preview for a set of rules.

To add support for a new issue category/dataset:
    1. Add mapping from GroupCategory to Dataset
    2. Add mapping from Dataset to snuba column name
        a. The column name should be a field in sentry.snuba.events.Column
    3. Add category-specific query params for GROUPS_STRATEGIES and GROUP_STRATEGIES
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
def get_dataset_columns(columns: Sequence[Column]) -> Dict[Dataset, Sequence[str]]:
    dataset_columns: Dict[Dataset, Sequence[str]] = {}
    for dataset, column_name in DATASET_TO_COLUMN_NAME.items():
        dataset_columns[dataset] = [
            getattr(column.value, column_name)
            for column in columns
            if getattr(column.value, column_name) is not None
        ]

    return dataset_columns


def _events_kwargs(group_ids: Sequence[int]) -> Dict[str, Any]:
    return {"conditions": [("group_id", "IN", group_ids)]}


def _transactions_kwargs(group_ids: Sequence[int]) -> Dict[str, Any]:
    return {
        "having": [("group_id", "IN", group_ids)],
        "conditions": [[["hasAny", ["group_ids", ["array", group_ids]]], "=", 1]],
        "aggregations": [
            ("arrayJoin", ["group_ids"], "group_id"),
            ("count", "group_id", "groupCount"),
        ],
    }


"""
Returns the rows that contain the group id.
If there's a many-to-many relationship, the group id column should be arrayjoined
"""
GROUPS_STRATEGIES = {
    Dataset.Events: _events_kwargs,
    Dataset.Transactions: _transactions_kwargs,
}


def _event_kwargs(group_id: int) -> Dict[str, Any]:
    return {"conditions": [("group_id", "=", group_id)]}


def _transaction_kwargs(group_id: int) -> Dict[str, Any]:
    return {"conditions": [[["has", ["group_ids", group_id]], "=", 1]]}


"""
Returns the rows that reference the group id without arrayjoining.
"""
GROUP_STRATEGIES = {
    Dataset.Events: _event_kwargs,
    Dataset.Transactions: _transaction_kwargs,
}
