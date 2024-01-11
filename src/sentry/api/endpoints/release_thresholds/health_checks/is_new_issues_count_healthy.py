from __future__ import annotations

from logging import getLogger

from sentry.api.endpoints.release_thresholds.types import EnrichedThreshold
from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.release_threshold.constants import TriggerType

logger = getLogger("sentry.release_threshold.health_checks.is_new_issues_count_healthy")


def is_new_issues_count_healthy(release_threshold: EnrichedThreshold) -> bool:
    release_id = release_threshold["release_id"]
    project_id = release_threshold["project_id"]
    time_range = (release_threshold["start"], release_threshold["end"])
    try:
        if release_threshold["environment"]:
            new_issues = GroupEnvironment.objects.filter(
                first_release__id=release_id,
                environment__id=release_threshold["environment"]["id"],
                group__project__id=project_id,
                first_seen__range=time_range,
            ).count()
        else:
            new_issues = Group.objects.filter(
                project__id=project_id, first_release__id=release_id, first_seen__range=time_range
            ).count()
    except Exception:
        logger.exception(
            "There was an error trying to grab new issue count",
            extra={
                "project": project_id,
                "release": release_id,
                "release_threshold": release_threshold["key"],
                "start": time_range[0],
                "end": time_range[1],
            },
        )
        return False

    baseline_value = release_threshold["value"]
    if release_threshold["trigger_type"] == TriggerType.OVER_STR:
        # If new issues is under/equal the threshold value, then it is healthy
        return new_issues <= baseline_value
    # Else, if new issues is over/equal the threshold value, then it is healthy
    return new_issues >= baseline_value
