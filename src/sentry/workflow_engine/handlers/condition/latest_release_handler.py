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
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.LATEST_RELEASE)
class LatestReleaseConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def get_latest_release(environment_id: int | None, event: GroupEvent) -> Release | None:
        cache_key = get_project_release_cache_key(event.group.project_id, environment_id)
        cached_latest_release = cache.get(cache_key)
        if cached_latest_release is None:
            organization_id = event.group.project.organization_id
            environments = None
            if environment_id:
                environments = [Environment.objects.get(id=environment_id)]
            try:
                latest_release_version = get_latest_release(
                    [event.group.project],
                    environments,
                    organization_id,
                )[0]
            except Release.DoesNotExist:
                return None
            latest_release = Release.objects.filter(
                version=latest_release_version, organization_id=organization_id
            ).first()
            if latest_release:
                cache.set(cache_key, latest_release, 600)
                return latest_release
            else:
                cache.set(cache_key, False, 600)
        return cached_latest_release

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        workflow = job.get("workflow")
        environment_id = workflow.environment_id if workflow else None
        latest_release = LatestReleaseConditionHandler.get_latest_release(environment_id, event)
        if not latest_release:
            return False

        releases = (
            v.lower()
            for k, v in event.tags
            if k.lower() == "release" or tagstore.backend.get_standardized_key(k) == "release"
        )

        return any(release == latest_release.version.lower() for release in releases)
