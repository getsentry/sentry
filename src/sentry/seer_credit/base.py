from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry.models.organization import Organization
from sentry.users.services.user import RpcUser
from sentry.utils.services import Service


class SeerCredit(Service):
    """
    Checks whether an organization can spend Seer credits. Self-hosted has no
    credit limits, so every check passes.
    """

    __all__ = ("check_seer_credits", "request_top_up")

    def __init__(self, **options: object) -> None:
        pass

    def check_seer_credits(self, request: CheckSeerCreditsRequest) -> CheckSeerCreditsResponse:
        return CheckSeerCreditsResponse(has_enough_credits=True)

    def request_top_up(self, organization: Organization, requester: RpcUser) -> None:
        """
        Asks the people who manage the organization's billing to add Seer credits,
        on behalf of a member who can't. Self-hosted never runs out, so nobody is asked.
        """
