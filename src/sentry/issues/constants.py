from sentry import tsdb
from sentry.issues.grouptype import GroupCategory
from sentry.tsdb.base import TSDBModel

ISSUE_TSDB_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.group,
    GroupCategory.PERFORMANCE: tsdb.models.group_performance,
}
ISSUE_TSDB_USER_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.users_affected_by_group,
    GroupCategory.PERFORMANCE: tsdb.models.users_affected_by_perf_group,
}


def get_issue_tsdb_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_GROUP_MODELS.get(issue_category, tsdb.models.group_generic)


def get_issue_tsdb_user_group_model(issue_category: GroupCategory) -> TSDBModel:
    return ISSUE_TSDB_USER_GROUP_MODELS.get(
        issue_category, tsdb.models.users_affected_by_generic_group
    )
