from sentry.issues.derived.framework import Feature, Pipeline, Scope, resolve
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry


class FeatureHistoryLimitExceeded(Exception):
    """The relevant action history is too large to replay inline."""


def replay_feature_from_log[T](
    group_id: int,
    pipeline: Pipeline[GroupActionLogEntry],
    feature: Feature[T],
    *,
    history_limit: int = 2000,
) -> T:
    """
    Replay a feature's action history. This does not update stored derived data.
    Runs on history_limit entries at maximum.
    """
    selected = Pipeline(resolve((feature,), pipeline.aggregators))
    query = GroupActionLogEntry.objects.filter(group_id=group_id).order_by("date_added", "id")
    if not any(agg.scope is Scope.ALL for agg in selected.aggregators):
        action_types = {
            action_type
            for agg in selected.aggregators
            if isinstance(agg.scope, tuple)
            for action_type in agg.scope
        }
        query = query.filter(type__in=action_types)
    entries = list(query[: history_limit + 1])
    if len(entries) > history_limit:
        raise FeatureHistoryLimitExceeded(
            f"History for {feature.name!r} exceeds {history_limit} entries"
        )
    return selected.run(entries)[feature]
