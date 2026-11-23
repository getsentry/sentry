from dataclasses import dataclass, field
from enum import StrEnum

from django.views.decorators.debug import sensitive_variables

from sentry import analytics, options
from sentry.agent_handoff.applications import get_handoff_application
from sentry.agent_handoff.codes import (
    AgentHandoff,
    HandoffExpired,
    HandoffIPMismatch,
    consume_handoff,
)
from sentry.agent_handoff.flows import get_flow
from sentry.agent_handoff.flows.base import InvalidHandoffContext
from sentry.analytics.events.agent_handoff import AgentHandoffClaimedEvent
from sentry.analytics.events.oauth_setup_code import OAuthSetupCodeIssuedEvent
from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    persist_authorization,
    resolve_organization,
)
from sentry.models.apisetupcode import ApiSetupCode
from sentry.models.organization import OrganizationStatus
from sentry.organizations.services.organization.service import organization_service
from sentry.users.models.user import User


class ClaimOutcome(StrEnum):
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    IP_MISMATCH = "ip_mismatch"
    INVALID = "invalid"


class ClaimFailureReason(StrEnum):
    # Covers unknown, already claimed and revoked codes. A claimed code is deleted, so these
    # can't be told apart.
    UNAVAILABLE = "unavailable"
    EXPIRED = "expired"
    ACCESS_CHANGED = "access_changed"
    SETUP_UNAVAILABLE = "setup_unavailable"


class HandoffClaimFailed(Exception):
    def __init__(self, reason: ClaimFailureReason) -> None:
        super().__init__(f"Agent handoff claim failed: {reason}")
        self.reason = reason


def _record_claim(outcome: ClaimOutcome, handoff: AgentHandoff | None) -> None:
    analytics.record(
        AgentHandoffClaimedEvent(
            outcome=outcome.value,
            handoff_id=handoff.handoff_id if handoff else None,
            user_id=handoff.user_id if handoff else None,
            organization_id=handoff.organization_id if handoff else None,
            flow=handoff.flow.value if handoff else None,
        )
    )


@dataclass(frozen=True)
class ClaimedHandoff:
    organization_slug: str
    organization_name: str
    user_email: str
    sentry_url: str
    client_id: str
    setup_code: str = field(repr=False)
    flow_instructions: str = field(repr=False)


@sensitive_variables()
def claim_handoff_context(code: str, *, ip_address: str | None) -> ClaimedHandoff:
    """Consume a handoff and mint credentials after revalidating its authorization."""
    try:
        handoff = consume_handoff(code, ip_address=ip_address)
    except HandoffExpired as error:
        _record_claim(ClaimOutcome.EXPIRED, error.handoff)
        raise HandoffClaimFailed(ClaimFailureReason.EXPIRED)
    except HandoffIPMismatch as error:
        _record_claim(ClaimOutcome.IP_MISMATCH, error.handoff)
        raise

    if handoff is None:
        _record_claim(ClaimOutcome.INVALID, None)
        raise HandoffClaimFailed(ClaimFailureReason.UNAVAILABLE)

    try:
        claim = _claim(handoff)
    except HandoffClaimFailed:
        _record_claim(ClaimOutcome.INVALID, handoff)
        raise
    _record_claim(ClaimOutcome.ACCEPTED, handoff)
    return claim


@sensitive_variables()
def _claim(handoff: AgentHandoff) -> ClaimedHandoff:
    # A new prompt mints against the currently configured application, so a changed or
    # disabled application is recoverable the same way as an unavailable code.
    application = get_handoff_application(handoff.scope_list)
    if application is None or application.id != handoff.application_id:
        raise HandoffClaimFailed(ClaimFailureReason.UNAVAILABLE)

    user = User.objects.get_or_none(id=handoff.user_id, is_active=True, is_suspended=False)
    if user is None:
        raise HandoffClaimFailed(ClaimFailureReason.ACCESS_CHANGED)

    context = organization_service.get_access_context(
        organization_id=handoff.organization_id, user_id=user.id
    )
    if (
        context is None
        or context.member is None
        or context.organization.status != OrganizationStatus.ACTIVE
    ):
        raise HandoffClaimFailed(ClaimFailureReason.ACCESS_CHANGED)

    try:
        organization_id = resolve_organization(application, user.id, str(handoff.organization_id))
    except InvalidOrganizationSelection:
        raise HandoffClaimFailed(ClaimFailureReason.ACCESS_CHANGED)

    try:
        flow_instructions = get_flow(handoff.flow).render(
            handoff.context,
            user_id=user.id,
            organization_id=context.organization.id,
        )
    except InvalidHandoffContext:
        raise HandoffClaimFailed(ClaimFailureReason.SETUP_UNAVAILABLE)

    persist_authorization(application, user.id, handoff.scope_list, organization_id)
    minted, setup_code = ApiSetupCode.mint(
        application=application,
        user_id=user.id,
        scope_list=handoff.scope_list,
        organization_id=organization_id,
    )
    analytics.record(
        OAuthSetupCodeIssuedEvent(
            user_id=user.id,
            organization_id=organization_id,
            application_id=application.id,
            setup_code_id=minted.id,
            flow=handoff.flow.value,
        )
    )
    return ClaimedHandoff(
        organization_slug=context.organization.slug,
        organization_name=context.organization.name,
        user_email=user.email,
        sentry_url=options.get("system.url-prefix"),
        client_id=application.client_id,
        setup_code=setup_code,
        flow_instructions=flow_instructions,
    )
