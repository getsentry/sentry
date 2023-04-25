from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import tsdb
from sentry.issues.grouptype import GroupCategory
from sentry.issues.utils import issue_category_can_create_group
from sentry.tsdb.base import TSDBModel

if TYPE_CHECKING:
    from sentry.models import Project

ISSUE_TSDB_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.group,
    GroupCategory.PERFORMANCE: tsdb.models.group_performance,
}
ISSUE_TSDB_USER_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.users_affected_by_group,
    GroupCategory.PERFORMANCE: tsdb.models.users_affected_by_perf_group,
}


def get_issue_tsdb_group_model(issue_category: GroupCategory, project: Project) -> TSDBModel:
    # TODO: Remove this entire branch when we remove the option, and remove `PERFORMANCE` from
    # ISSUE_TSDB_GROUP_MODELS
    if issue_category == GroupCategory.PERFORMANCE and issue_category_can_create_group(
        GroupCategory.PERFORMANCE, project
    ):
        return tsdb.models.group_generic
    # TODO: Need to get generic when perf search issue flag is true and perf issue
    return ISSUE_TSDB_GROUP_MODELS.get(issue_category, tsdb.models.group_generic)


def get_issue_tsdb_user_group_model(issue_category: GroupCategory, project: Project) -> TSDBModel:
    # TODO: Remove this entire branch when we remove the option, and remove `PERFORMANCE` from
    # ISSUE_TSDB_USER_GROUP_MODELS
    if issue_category == GroupCategory.PERFORMANCE and issue_category_can_create_group(
        GroupCategory.PERFORMANCE, project
    ):
        return tsdb.models.users_affected_by_generic_group
    return ISSUE_TSDB_USER_GROUP_MODELS.get(
        issue_category, tsdb.models.users_affected_by_generic_group
    )
