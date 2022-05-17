from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping
from urllib.parse import urljoin

from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import NotificationSettingTypes
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.db.models import Model
    from sentry.models import Team, User


class AutoSyncNotification(ProjectNotification):
    metrics_key = "auto_sync"
    notification_setting_type = NotificationSettingTypes.DEPLOY
    template_path = "sentry/emails/codeowners-auto-sync-failure"

    def determine_recipients(self) -> Iterable[Team | User]:
        return self.organization.get_owners()  # type: ignore

    @property
    def reference(self) -> Model | None:
        return None

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # For now, return only email.
        return [ExternalProviders.EMAIL]

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "Unable to Complete CODEOWNERS Auto-Sync"

    def get_context(self) -> MutableMapping[str, Any]:
        return {"project_name": self.project.name}

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        context["url"] = str(
            urljoin(
                absolute_uri(
                    f"/settings/{self.organization.slug}/projects/{self.project.slug}/ownership/"
                ),
                self.get_sentry_query_params(ExternalProviders.EMAIL, recipient),
            )
        )
        return context
