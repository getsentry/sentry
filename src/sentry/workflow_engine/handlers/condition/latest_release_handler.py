from typing import Any

from sentry import tagstore
from sentry.eventstore.models import GroupEvent
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.rules.filters.latest_release import get_project_release_cache_key
from sentry.search.utils import get_latest_release
from sentry.utils.cache import cache
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


def get_latest_release_for_env(
    environment: Environment | None, event: GroupEvent
) -> Release | None:
    cache_key = get_project_release_cache_key(
        event.group.project_id, environment.id if environment else None
    )
    latest_release = cache.get(cache_key)
    if latest_release is not None:
        return latest_release

    organization_id = event.group.project.organization_id
    environments = [environment] if environment else None
    try:
        latest_release_version = get_latest_release(
            [event.group.project],
            environments,
            organization_id,
        )[0]
    except Release.DoesNotExist:
        return None
    latest_release = Release.objects.get(
        version=latest_release_version, organization_id=organization_id
    )
    cache.set(cache_key, latest_release or False, 600)
    return latest_release


@condition_handler_registry.register(Condition.LATEST_RELEASE)
class LatestReleaseConditionHandler(DataConditionHandler[WorkflowEventData]):
    group = DataConditionHandler.Group.ACTION_FILTER
    subgroup = DataConditionHandler.Subgroup.EVENT_ATTRIBUTES
    comparison_json_schema = {"type": "boolean"}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        event = event_data.event
        if not isinstance(event, GroupEvent):
            return False

        latest_release = get_latest_release_for_env(event_data.workflow_env, event)
        if not latest_release:
            return False

        releases = (
            v.lower()
            for k, v in event.tags
            if k.lower() == "release" or tagstore.backend.get_standardized_key(k) == "release"
        )

        return any(release == latest_release.version.lower() for release in releases)
