from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping, MutableMapping
from typing import TYPE_CHECKING, Any

from sentry.db.models import Model
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.user import User

logger = logging.getLogger(__name__)


class DailySummaryNotification(BaseNotification):
    metrics_key = "daily_summary"
    template_path = "daily-summary"
    type = "integration.daily_summary"
    message_builder = "SlackDailySummaryMessageBuilder"

    def __init__(
        self,
        organization: Organization,
        recipient: User,
        provider: ExternalProviders,
        project_context: {},
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
        return "Daily Summary for Your Services"

    def get_context(self) -> MutableMapping[str, Any]:
        return self.project_context

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return ""

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return ""

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        return "Getting this at a funky time? This sends at 4pm for whatever time zone you have set. Want to unsubscribe? Too bad, it's internal only."
