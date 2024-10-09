from collections.abc import Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any

from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models import User
from sentry.users.services.user import RpcUser


class MessagingInteractionType(Enum):
    """A way in which a user can interact with Sentry through a messaging app."""

    # Direct interactions with the user
    HELP = "HELP"
    LINK_IDENTITY = "LINK_IDENTITY"
    UNLINK_IDENTITY = "UNLINK_IDENTITY"
    LINK_TEAM = "LINK_TEAM"
    UNLINK_TEAM = "UNLINK_TEAM"

    # Interactions on Issues
    STATUS = "STATUS"
    ARCHIVE_DIALOG = "ARCHIVE_DIALOG"
    ARCHIVE = "ARCHIVE"
    ASSIGN_DIALOG = "ASSIGN_DIALOG"
    ASSIGN = "ASSIGN"
    UNASSIGN = "ASSIGN"
    RESOLVE_DIALOG = "RESOLVE_DIALOG"
    RESOLVE = "RESOLVE"
    UNRESOLVE = "UNRESOLVE"
    IGNORE = "IGNORE"
    MARK_ONGOING = "MARK_ONGOING"

    # Automatic behaviors
    UNFURL_ISSUES = "UNFURL_ISSUES"
    UNFURL_METRIC_ALERTS = "UNFURL_METRIC_ALERTS"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class MessagingInteractionEvent(EventLifecycleMetric):
    """An instance to be recorded of a user interacting through a messaging app."""

    interaction_type: MessagingInteractionType
    spec: MessagingIntegrationSpec

    # Optional attributes to populate extras
    user: User | RpcUser | None = None
    organization: Organization | RpcOrganization | None = None

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        return self.get_standard_key(
            domain="messaging",
            integration_name=self.spec.provider_slug,
            interaction_type=str(self.interaction_type),
            outcome=outcome,
        )

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "user_id": (self.user.id if self.user else None),
            "organization_id": (self.organization.id if self.organization else None),
        }
