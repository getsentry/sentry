from enum import Enum

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.on_call.spec import OnCallSpec
from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization
from sentry.users.models import User
from sentry.users.services.user import RpcUser


class OnCallInteractionType(Enum):
    """
    A way in which a user can interact with Sentry through an on-call app.
    """

    # General interactions
    ADD_KEY = "ADD_KEY"
    POST_INSTALL = "POST_INSTALL"
    # Interacting with external alerts
    CREATE = "CREATE"  # create an alert in Opsgenie/Pagerduty
    RESOLVE = "RESOLVE"  # resolve an alert in Opsgenie/Pagerduty

    # Opsgenie only
    VERIFY_KEYS = "VERIFY_KEYS"
    VERIFY_TEAM = "VERIFY_TEAM"
    MIGRATE_PLUGIN = "MIGRATE_PLUGIN"

    # PagerDuty only
    VALIDATE_SERVICE = "VALIDATE_SERVICE"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class OnCallInteractionEvent(EventLifecycleMetric):
    """
    An instance to be recorded of a user interacting with Sentry through an on-call app.
    """

    interaction_type: OnCallInteractionType
    spec: OnCallSpec

    # Optional attributes to populate extras
    user: User | RpcUser | None = None
    organization: Organization | RpcOrganization | None = None

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        return self.get_standard_key(
            domain=IntegrationDomain.ON_CALL_SCHEDULING,
            integration_name=self.spec.provider_slug,
            interaction_type=str(self.interaction_type),
            outcome=outcome,
        )
