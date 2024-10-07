from collections.abc import Mapping
from enum import Enum
from typing import Any

from attr import dataclass

from sentry.integrations.opsgenie.spec import OpsgenieOnCallSpec
from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models import User
from sentry.users.services.user import RpcUser


class OnCallInteractionType(Enum):
    """
    A way in which a user can interact with Sentry through an on-call app.
    """

    # TODO: add the interactions
    # General interactions
    ADD_KEY = "ADD_KEY"
    # Interacting with external alerts
    CREATE = "CREATE"  # create an alert in Opsgenie/Pagerduty
    RESOLVE = "RESOLVE"  # resolve an alert in Opsgenie/Pagerduty

    # Opsgenie only
    VERIFY_KEYS = "VERIFY_KEYS"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class OnCallInteractionEvent(EventLifecycleMetric):
    """
    An instance to be recorded of a user interacting with Sentry through an on-call app.
    """

    interaction_type: OnCallInteractionType
    spec: OpsgenieOnCallSpec  # TODO: also add pagerduty oncall spec, or make a common spec class to inherit

    # Optional attributes to populate extras
    user: User | RpcUser | None = None
    organization: Organization | RpcOrganization | None = None

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        return self.get_standard_key(
            domain="on_call",
            integration_name=self.spec.provider_slug,
            interaction_type=str(self.interaction_type),
            outcome=outcome,
        )

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "user_id": (self.user.id if self.user else None),
            "organization_id": (self.organization.id if self.organization else None),
        }
