from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry.utils.services import Service


class SeerCredit(Service):
    """
    Checks whether an organization can spend Seer credits. Self-hosted has no
    credit limits, so every check passes.
    """

    __all__ = ("check_seer_credits",)

    def __init__(self, **options: object) -> None:
        pass

    def check_seer_credits(self, request: CheckSeerCreditsRequest) -> CheckSeerCreditsResponse:
        return CheckSeerCreditsResponse(has_enough_credits=True)
