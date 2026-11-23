from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_post_parameters
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.agent_handoff.claims import (
    ClaimFailureReason,
    HandoffClaimFailed,
    claim_handoff_context,
)
from sentry.agent_handoff.codes import HANDOFF_LIFETIME, HandoffIPMismatch
from sentry.agent_handoff.serializers import (
    AgentHandoffClaimResponse,
    AgentHandoffClaimSerializer,
)
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import SentryAPIException
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_GONE,
    RESPONSE_TOO_MANY_REQUESTS,
)
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ratelimits import backend as ratelimiter
from sentry.utils import metrics

_CLAIM_WINDOW = 60


class AgentHandoffCrossOriginError(SentryAPIException):
    status_code = 403
    code = "agent-handoff-cross-origin"
    message = "Cross-origin handoff claims are not allowed."
    auth_challenge = False


class AgentHandoffIPMismatchError(SentryAPIException):
    status_code = 403
    code = "agent-handoff-ip-mismatch"
    message = (
        "The handoff code is pinned to a different IP address. Ask the user to turn "
        'off "Use IP pinning" and copy a new handoff prompt.'
    )
    auth_challenge = False


class AgentHandoffMalformedError(SentryAPIException):
    status_code = 400
    code = "agent-handoff-malformed"
    message = (
        "The handoff code is malformed. Check that the full code was copied, or ask the user "
        "to copy a new handoff prompt from Sentry."
    )


# Every claim failure keeps the 410 status because the code is spent or unusable either way;
# the error code and message tell the agent what the user has to do next.
class AgentHandoffUnavailableError(SentryAPIException):
    status_code = 410
    code = "agent-handoff-unavailable"
    message = (
        "The handoff code was already used or is no longer valid. Ask the user to copy a new "
        "handoff prompt from Sentry."
    )


class AgentHandoffExpiredError(SentryAPIException):
    status_code = 410
    code = "agent-handoff-expired"
    message = (
        f"The handoff code expired. Codes must be used within "
        f"{int(HANDOFF_LIFETIME.total_seconds() // 60)} minutes; ask the user to copy a new "
        "handoff prompt from Sentry."
    )


class AgentHandoffAccessChangedError(SentryAPIException):
    status_code = 410
    code = "agent-handoff-access-changed"
    message = (
        "The user's Sentry account or organization access changed after the handoff was "
        "created. Ask the user to confirm they can still access the organization in Sentry, "
        "then copy a new handoff prompt."
    )


class AgentHandoffSetupUnavailableError(SentryAPIException):
    status_code = 410
    code = "agent-handoff-setup-unavailable"
    message = (
        "The setup this handoff was created for is no longer available, for example because "
        "it was cancelled or its project was deleted. Ask the user to start the setup again "
        "in Sentry and copy the new handoff prompt."
    )


_CLAIM_FAILURE_ERRORS: dict[ClaimFailureReason, type[SentryAPIException]] = {
    ClaimFailureReason.UNAVAILABLE: AgentHandoffUnavailableError,
    ClaimFailureReason.EXPIRED: AgentHandoffExpiredError,
    ClaimFailureReason.ACCESS_CHANGED: AgentHandoffAccessChangedError,
    ClaimFailureReason.SETUP_UNAVAILABLE: AgentHandoffSetupUnavailableError,
}


class AgentHandoffRateLimitedError(SentryAPIException):
    status_code = 429
    code = "agent-handoff-rate-limited"
    message = "Wait 60 seconds, then retry the same handoff code."
    wait = _CLAIM_WINDOW


class AgentHandoffClaimRequestSerializer(serializers.Serializer):
    handoff_code = serializers.RegexField(
        r"^sntryh_[A-Za-z0-9_-]{43}$",
        help_text="The private agent handoff code to claim.",
        trim_whitespace=False,
    )


@extend_schema(tags=["Organizations"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
@method_decorator(sensitive_post_parameters("handoff_code"), name="dispatch")
class ClaimAgentHandoffEndpoint(Endpoint):
    owner = ApiOwner.VALUE_DISCOVERY
    publish_status = {"POST": ApiPublishStatus.PUBLIC}
    idempotent_methods = frozenset()
    authentication_classes = ()
    permission_classes = ()
    parser_classes = (JSONParser,)

    @extend_schema(
        operation_id="claimAgentHandoff",
        summary="Claim an Agent Handoff",
        request=AgentHandoffClaimRequestSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "AgentHandoffClaimResponse", AgentHandoffClaimResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            410: RESPONSE_GONE,
            429: RESPONSE_TOO_MANY_REQUESTS,
        },
    )
    def post(
        self, request: Request
    ) -> Response[AgentHandoffClaimResponse] | Response[DetailResponse]:
        """Exchange a private handoff code for the context needed to authenticate the CLI.

        The response also determines the next steps used to guide the user or agent.
        """
        if request.META.get("HTTP_ORIGIN"):
            raise AgentHandoffCrossOriginError

        if ratelimiter.is_limited(
            f"agent-handoff:claim:{request.META.get('REMOTE_ADDR', 'unknown')}",
            limit=10,
            window=_CLAIM_WINDOW,
        ):
            raise AgentHandoffRateLimitedError

        serializer = AgentHandoffClaimRequestSerializer(data=request.data)
        if not serializer.is_valid():
            raise AgentHandoffMalformedError

        code = serializer.validated_data["handoff_code"]

        try:
            claim = claim_handoff_context(code, ip_address=request.META.get("REMOTE_ADDR"))
        except HandoffIPMismatch:
            metrics.incr("agent_handoff.claim.ip_mismatch", sample_rate=1.0)
            raise AgentHandoffIPMismatchError
        except HandoffClaimFailed as error:
            raise _CLAIM_FAILURE_ERRORS[error.reason]

        return Response(serialize(claim, request.user, serializer=AgentHandoffClaimSerializer()))
