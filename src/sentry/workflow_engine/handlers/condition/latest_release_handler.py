from typing import Any, Literal

from sentry import tagstore
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.rules.filters.latest_adopted_release_filter import (
    get_project_release_cache_key as latest_adopted_release_cache_key,
)
from sentry.rules.filters.latest_release import (
    get_project_release_cache_key as latest_release_cache_key,
)
from sentry.search.utils import get_latest_release
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.caches import CacheAccess
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowEventData


class _LatestReleaseCacheAccess(CacheAccess[Release | Literal[False]]):
    """
    If we have a release for a project in an environment, we cache it.
    If we don't, we cache False.
    """

    def __init__(self, event: GroupEvent, environment: Environment | None):
        self._key = latest_release_cache_key(
            event.group.project_id, environment.id if environment else None
        )

    def key(self) -> str:
        return self._key


class _LatestAdoptedReleaseCacheAccess(CacheAccess[Release | Literal[False]]):
    """
    If we have a latest adopted release for a project in an environment, we cache it.
    If we don't, we cache False.
    """

    def __init__(self, event: GroupEvent, environment: Environment):
        self._key = latest_adopted_release_cache_key(event.group.project_id, environment.id)

    def key(self) -> str:
        return self._key


def get_latest_adopted_release_for_env(
    environment: Environment, event: GroupEvent
) -> Release | None:
    """
    Get the latest adopted release for a project in an environment.
    """
    return _get_latest_release_for_env_impl(
        environment,
        event,
        only_adopted=True,
        cache_access=_LatestAdoptedReleaseCacheAccess(event, environment),
    )


def get_latest_release_for_env(
    environment: Environment | None,
    event: GroupEvent,
) -> Release | None:
    """
    Get the latest release for a project in an environment.
    NOTE: This is independent of whether it has been adopted or not.
    """
    return _get_latest_release_for_env_impl(
        environment,
        event,
        only_adopted=False,
        cache_access=_LatestReleaseCacheAccess(event, environment),
    )


def _get_latest_release_for_env_impl(
    environment: Environment | None,
    event: GroupEvent,
    only_adopted: bool,
    cache_access: CacheAccess[Release | Literal[False]],
) -> Release | None:
    latest_release = cache_access.get()
    if latest_release is not None:
        if latest_release is False:
            return None
        return latest_release

    organization_id = event.group.project.organization_id
    environments = [environment] if environment else None

    def record_get_latest_release_result(result: str) -> None:
        metrics.incr(
            "workflow_engine.latest_release.get_latest_release",
            tags={
                "has_environment": str(environment is not None),
                "result": result,
                "only_adopted": str(only_adopted),
            },
        )

    try:
        latest_release_version = get_latest_release(
            [event.group.project],
            environments,
            organization_id,
            adopted=only_adopted,
        )[0]
        record_get_latest_release_result("success")
    except Release.DoesNotExist:
        record_get_latest_release_result("does_not_exist")
        cache_access.set(False, 600)
        return None
    latest_release = Release.objects.get(
        version=latest_release_version, organization_id=organization_id
    )
    cache_access.set(latest_release or False, 600)
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
