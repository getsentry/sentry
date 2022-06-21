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

        last_release_version: Optional[str] = event.group.get_last_release()
        if not last_release_version:
            return False

        last_release: Release = Release.get(project=event.project, version=last_release_version)
        if not last_release:
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
                        release_env_project = ReleaseProjectEnvironment.objects.filter(
                            release_id=release.id, project=release.project_id, environment_id=env.id
                        ).first()

                        release_env = ReleaseEnvironment.objects.filter(
                            release_id=release.id, environment_id=env.id
                        ).first()

                        if release_env_project and release_env_project.first_seen:
                            return release_env_project.first_seen

                        if release_env and release_env.first_seen:
                            return release_env.first_seen
            return None

        deploy_time = release_deploy_time(last_release, event.get_environment())
        if deploy_time:
            return bool(now_minus_1_hour.timestamp() <= deploy_time <= now)

        return False

    def passes(self, event: Event, state: EventState) -> bool:
        if self.rule.environment_id is None:  # type: ignore
            return (state.is_new or state.is_regression) and self.is_in_active_release(event)
        else:
            return (
                state.is_new_group_environment or state.is_regression
            ) and self.is_in_active_release(event)
