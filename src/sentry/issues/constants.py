from __future__ import annotations
from typing import int

from sentry.issues.grouptype import GroupCategory
from sentry.snuba.dataset import Dataset
from sentry.tsdb.base import TSDBModel
from sentry.utils.snuba import DATASETS

ISSUE_TSDB_GROUP_MODELS = {
    GroupCategory.ERROR: TSDBModel.group,
}
ISSUE_TSDB_USER_GROUP_MODELS = {
    GroupCategory.ERROR: TSDBModel.users_affected_by_group,
}

# Use this with DATASETS from sentry/utils/snuba.py
TSDB_MODEL_DATASET: dict[TSDBModel, Dataset] = {
    TSDBModel.group: Dataset.Events,
    TSDBModel.group_generic: Dataset.IssuePlatform,
    TSDBModel.users_affected_by_group: Dataset.Events,
    TSDBModel.users_affected_by_generic_group: Dataset.IssuePlatform,
}


def get_issue_tsdb_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_GROUP_MODELS.get(issue_category, TSDBModel.group_generic)


def get_issue_tsdb_user_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_USER_GROUP_MODELS.get(
        issue_category, TSDBModel.users_affected_by_generic_group
    )


def get_dataset_column_name(tsdb_model: TSDBModel, column_name: str) -> str | None:
    dataset = TSDB_MODEL_DATASET.get(tsdb_model, Dataset.IssuePlatform)
    col_mapping = DATASETS[dataset]

    return col_mapping.get(column_name)
