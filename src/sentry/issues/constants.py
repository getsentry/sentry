from __future__ import annotations

from sentry.issues.grouptype import GroupCategory
from sentry.tsdb.base import TSDBModel

ISSUE_TSDB_GROUP_MODELS = {
    GroupCategory.ERROR: TSDBModel.group,
}
ISSUE_TSDB_USER_GROUP_MODELS = {
    GroupCategory.ERROR: TSDBModel.users_affected_by_group,
}


def get_issue_tsdb_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_GROUP_MODELS.get(issue_category, TSDBModel.group_generic)


def get_issue_tsdb_user_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_USER_GROUP_MODELS.get(
        issue_category, TSDBModel.users_affected_by_generic_group
    )
