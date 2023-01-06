from sentry import tsdb
from sentry.types.issues import GroupCategory

ISSUE_TSDB_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.group,
    GroupCategory.PERFORMANCE: tsdb.models.group_performance,
    GroupCategory.PROFILE: tsdb.models.group_profiling,
}
ISSUE_TSDB_USER_GROUP_MODELS = {
    GroupCategory.ERROR: tsdb.models.users_affected_by_group,
    GroupCategory.PERFORMANCE: tsdb.models.users_affected_by_perf_group,
    GroupCategory.PROFILE: tsdb.models.users_affected_by_profile_group,
}
