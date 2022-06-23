from datetime import timedelta
from typing import Optional

from django.db.models import DateTimeField
from django.utils import timezone

from sentry.eventstore.models import Event
from sentry.models import (
    Deploy,
    Environment,
    Project,
    Release,
    ReleaseEnvironment,
    ReleaseProjectEnvironment,
)
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.search.utils import get_latest_release


def _get_latest_release(
    organization_id: int, environment_id: Optional[int], project: Project
) -> Optional[Release]:
    environments = (
        None if not environment_id else [Environment.objects.filter(id=environment_id).first()]
    )

    try:
        latest_release_versions = get_latest_release(
            [project],
            environments,
            organization_id,
        )
    except Release.DoesNotExist:
        return None

    latest_releases = list(
        Release.objects.filter(version=latest_release_versions[0], organization_id=organization_id)
    )

    return latest_releases[0] if latest_releases else None


class ActiveReleaseEventCondition(EventCondition):
    id = "sentry.rules.conditions.active_release.ActiveReleaseEventCondition"
    label = "A new issue is created within an active release (1 hour of deployment)"

    def is_in_active_release(self, event: Event) -> bool:
        if not event.group:
            return False

        now = timezone.now()
        now_minus_1_hour = now - timedelta(hours=1.0)

        if not event.group or not event.project:
            return False

        # XXX(gilbert):
        # adapted from LatestReleaseFilter
        # need to add caching later on
        environment_id = None if self.rule is None else self.rule.environment_id
        organization_id = event.group.project.organization_id

        latest_release = _get_latest_release(organization_id, environment_id, event.project)

        if not latest_release:
            return False

        def release_deploy_time(release: Release, env_id: Optional[int]) -> Optional[DateTimeField]:
            # check deploy -> release first
            # then Release.date_released
            # then EnvironmentRelease.first_seen
            last_deploy: Deploy = Deploy.objects.filter(id=release.last_deploy_id).first()
            if last_deploy:
                return last_deploy.date_finished
            else:
                if release.date_released:
                    return release.date_released
                else:
                    if env_id:
                        release_project_env = ReleaseProjectEnvironment.objects.filter(
                            release_id=release.id, project=release.project_id, environment_id=env_id
                        ).first()

                        release_env = ReleaseEnvironment.objects.filter(
                            release_id=release.id, environment_id=env_id
                        ).first()

                        if release_project_env and release_project_env.first_seen:
                            return release_project_env.first_seen

                        if release_env and release_env.first_seen:
                            return release_env.first_seen

            return None

        deploy_time = release_deploy_time(latest_release, environment_id)
        if deploy_time:
            return bool(now_minus_1_hour <= deploy_time <= now)

        return False

    def passes(self, event: Event, state: EventState) -> bool:
        if self.rule and self.rule.environment_id is None:
            return (state.is_new or state.is_regression) and self.is_in_active_release(event)
        else:
            return (
                state.is_new_group_environment or state.is_regression
            ) and self.is_in_active_release(event)
