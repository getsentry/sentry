from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping

from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import NotificationSettingTypes
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Team, User


class AutoSyncNotification(ProjectNotification):
    notification_setting_type = NotificationSettingTypes.DEPLOY

    def determine_recipients(self) -> Iterable[Team | User]:
        raise self.organization.get_owners()

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        # For now, filter to only email.
        return {ExternalProviders.EMAIL: super().get_participants()[ExternalProviders.EMAIL]}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "Unable to Complete CODEOWNERS Auto-Sync"

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "project_name": self.project.name,
            "url": absolute_uri(
                f"/settings/{self.organization.slug}/projects/{self.project.slug}/ownership/"
            ),
        }

    def get_type(self) -> str:
        return "deploy.auto-sync"

    def get_filename(self) -> str:
        return "codeowners-auto-sync-failure"

    def get_category(self) -> str:
        return "auto-sync"
