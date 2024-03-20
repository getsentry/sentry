from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping
from typing import TYPE_CHECKING, Any

from sentry.db.models import Model
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.tasks.summaries.utils import DailySummaryProjectContext
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


class DailySummaryNotification(BaseNotification):
    metrics_key = "daily_summary"
    template_path = "daily-summary"
    type = "integration.daily_summary"
    message_builder = "SlackDailySummaryMessageBuilder"

    def __init__(
        self,
        organization: Organization,
        recipient: RpcActor,
        provider: ExternalProviders,
        project_context: dict[int, DailySummaryProjectContext],
    ) -> None:
        super().__init__(organization)
        self.recipient = recipient
        self.provider = provider
        self.project_context = project_context

    @property
    def reference(self) -> Model | None:
        return None

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        return {self.provider: {self.recipient}}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return self.get_message_description(self.recipient, self.provider)

    def get_context(self) -> dict[int, DailySummaryProjectContext]:  # type: ignore
        return self.project_context

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return ""

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> Any:
        return (
            f"Daily Summary for Your {self.organization.slug.title()} Projects (internal only!!!)"
        )

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return ""

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        url_str = "/settings/account/notifications/"
        url = str(self.organization.absolute_url(url_str))
        return f"Getting this at a funky time? This sends at 4pm for whatever time zone you have set. | <{url}|*Account Settings*>"
