from __future__ import annotations

from datetime import datetime
from logging import getLogger

from sentry.models.group import Group
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.release_threshold import ReleaseThreshold
from sentry.models.release_threshold.constants import TriggerType

default_logger = getLogger("sentry.releases.servicer")


def is_new_issues_count_healthy(
    project: Project,
    release: Release,
    release_threshold: ReleaseThreshold,
    start: datetime,
    end: datetime,
) -> bool:
    try:
        if release_threshold.environment:
            new_issues = GroupEnvironment.objects.filter(
                first_release=release,
                environment=release_threshold.environment,
                group__project=project,
                first_seen__range=(start, end),
            ).count()
        else:
            new_issues = Group.objects.filter(
                project=project, first_release=release, first_seen__range=(start, end)
            ).count()
    except Exception:
        default_logger.exception(
            "There was an error trying to grab new issue count",
            extra={
                "project": project.id,
                "release": release.id,
                "release_threshold": release_threshold.id,
                "start": start,
                "end": end,
            },
        )
        return False

    baseline_value = release_threshold.value
    if release_threshold.trigger_type == TriggerType.OVER:
        # If new issues is under/equal the threshold value, then it is healthy
        return new_issues <= baseline_value
    # Else, if new issues is over/equal the threshold value, then it is healthy
    return new_issues >= baseline_value
