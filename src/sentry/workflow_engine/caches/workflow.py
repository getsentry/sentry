from django.db.models import Q

from sentry.models.environment import Environment
from sentry.utils.cache import cache
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.detector import Detector

# TODO - Make this a sentry option? cache=0?1 could disable it w/o a deploy
# Cache timeout for 5 minutes
CACHE_TTL = 300


def processing_workflow_cache_key(detector_id: int, env_id: int | None) -> str:
    return f"workflows_by_detector_env:{detector_id}:{env_id}"


def invalidate_processing_workflows(detector_id: int | None, env_id: int | None) -> None:
    if detector_id is None:
        # TODO - clear the whole cache, wild card?
        raise Exception("Not implemented")

    if env_id is None:
        # TODO - set a wild card for the env_id?
        # We need to clear all workflow environments on detector change
        pass

    cache_key = processing_workflow_cache_key(detector_id, env_id)
    return cache.delete(cache_key)


def get_processing_workflows(detector: Detector, environment: Environment | None) -> set[Workflow]:
    """
    Use this method to select workflows for processing.

    This method uses a read-through cache, and returns which workflows to evaluate.
    """
    env_id = environment.id if environment is not None else None
    cache_key = processing_workflow_cache_key(detector.id, env_id)
    workflows = cache.get(cache_key)

    if workflows is None:
        environment_filter = (
            (Q(environment_id=None) | Q(environment_id=environment.id))
            if environment
            else Q(environment_id=None)
        )

        workflows = set(
            Workflow.objects.filter(
                environment_filter,
                detectorworkflow__detector_id=detector.id,
                enabled=True,
            )
            .select_related("environment")
            .distinct()
        )

        cache.set(cache_key, workflows, timeout=CACHE_TTL)

    return workflows
