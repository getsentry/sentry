from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping

from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.db.models import Model


class AutoSyncNotification(ProjectNotification):
    metrics_key = "auto_sync"
    notification_setting_type = NotificationSettingTypes.DEPLOY
    template_path = "sentry/emails/codeowners-auto-sync-failure"

    def determine_recipients(self) -> Iterable[RpcActor]:
        return RpcActor.many_from_object(self.organization.get_owners())

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
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        context = super().get_recipient_context(recipient, extra_context)
        context["url"] = self.organization.absolute_url(
            f"/settings/{self.organization.slug}/projects/{self.project.slug}/ownership/",
            query=self.get_sentry_query_params(ExternalProviders.EMAIL, recipient),
        )
        return context
