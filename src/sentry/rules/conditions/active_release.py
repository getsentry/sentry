from datetime import timedelta
from typing import Optional

from django.db.models import DateTimeField
from django.utils import timezone

from sentry.eventstore.models import GroupEvent
from sentry.models import Deploy, Release, ReleaseEnvironment, ReleaseProjectEnvironment
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class ActiveReleaseEventCondition(EventCondition):
    id = "sentry.rules.conditions.active_release.ActiveReleaseEventCondition"
    label = "A new issue is created within an active release (1 hour of deployment)"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        if self.rule and self.rule.environment_id is None:
            return (state.is_new or state.is_regression) and self.is_in_active_release(event)
        else:
            return (
                state.is_new_group_environment or state.is_regression
            ) and self.is_in_active_release(event)

    @staticmethod
    def latest_release(event: GroupEvent) -> Optional[Release]:
        return Release.objects.filter(
            organization_id=event.project.organization_id,
            projects__id=event.project_id,
            version=event.release,
        ).first()

    @staticmethod
    def is_in_active_release(event: GroupEvent) -> bool:
        if not event.group:
            return False

        now = timezone.now()
        now_minus_1_hour = now - timedelta(hours=1.0)

        if not event.group or not event.project:
            return False

        event_release = ActiveReleaseEventCondition.latest_release(event)

        if not event_release:
            return False

        def release_deploy_time(release: Release, env_id: Optional[int]) -> Optional[DateTimeField]:
            # check deploy -> release first
            # then Release.date_released
            # then EnvironmentRelease.first_seen
            last_deploy: Deploy = (
                Deploy.objects.filter(release_id=release.id).order_by("-date_finished").first()
                or Deploy.objects.filter(id=release.last_deploy_id).first()
            )
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

        evt_env = event.get_environment()
        deploy_time = release_deploy_time(event_release, evt_env.id if evt_env else None)
        if deploy_time:
            return bool(now_minus_1_hour <= deploy_time <= now)

        return False
