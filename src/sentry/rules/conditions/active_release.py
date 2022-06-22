from datetime import timedelta
from typing import Optional

from django.db.models import DateTimeField
from django.utils import timezone

from sentry.eventstore.models import Event
from sentry.models import (
    Deploy,
    Environment,
    Release,
    ReleaseEnvironment,
    ReleaseProjectEnvironment,
)
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.search.utils import get_latest_release


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
        environments = None
        if environment_id:
            environments = [Environment.objects.get(id=environment_id)]

        try:
            latest_release_versions = get_latest_release(
                [event.group.project],
                environments,
                organization_id,
            )
        except Release.DoesNotExist:
            return False

        latest_releases = list(
            Release.objects.filter(
                version=latest_release_versions[0], organization_id=organization_id
            )
        )

        if not latest_releases:
            return False

        def release_deploy_time(
            release: Release, env: Optional[Environment]
        ) -> Optional[DateTimeField]:
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
                    if env:
                        release_project_env = ReleaseProjectEnvironment.objects.filter(
                            release_id=release.id, project=release.project_id, environment_id=env.id
                        ).first()

                        release_env = ReleaseEnvironment.objects.filter(
                            release_id=release.id, environment_id=env.id
                        ).first()

                        if release_project_env and release_project_env.first_seen:
                            return release_project_env.first_seen

                        if release_env and release_env.first_seen:
                            return release_env.first_seen

            return None

        deploy_time = release_deploy_time(latest_releases[0], environments)
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
