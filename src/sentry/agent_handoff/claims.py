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
from sentry.agent_handoff.runbook import render_agent_runbook
from sentry.analytics.events.agent_handoff import AgentHandoffClaimedEvent
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


def _record_claim(outcome: ClaimOutcome, handoff: AgentHandoff | None) -> None:
    analytics.record(
        AgentHandoffClaimedEvent(
            outcome=outcome.value,
            user_id=handoff.user_id if handoff else None,
            organization_id=handoff.organization_id if handoff else None,
            flow=handoff.flow.value if handoff else None,
            run_id=handoff.context.run_id if handoff and handoff.context else None,
        )
    )


@sensitive_variables()
def claim_handoff(code: str, *, ip_address: str | None) -> str | None:
    """Consume a handoff and render credentials after revalidating its authorization."""
    try:
        handoff = consume_handoff(code, ip_address=ip_address)
    except HandoffExpired as error:
        _record_claim(ClaimOutcome.EXPIRED, error.handoff)
        return None
    except HandoffIPMismatch as error:
        _record_claim(ClaimOutcome.IP_MISMATCH, error.handoff)
        raise

    if handoff is None:
        _record_claim(ClaimOutcome.INVALID, None)
        return None

    guide = _render_guide(handoff)
    _record_claim(ClaimOutcome.ACCEPTED if guide is not None else ClaimOutcome.INVALID, handoff)
    return guide


@sensitive_variables()
def _render_guide(handoff: AgentHandoff) -> str | None:
    user = User.objects.filter(id=handoff.user_id, is_active=True, is_suspended=False).first()
    application = get_handoff_application(handoff.scope_list)
    if user is None or application is None or application.id != handoff.application_id:
        return None

    context = organization_service.get_access_context(
        organization_id=handoff.organization_id, user_id=user.id
    )
    if (
        context is None
        or context.member is None
        or context.organization.status != OrganizationStatus.ACTIVE
    ):
        return None

    try:
        organization_id = resolve_organization(application, user.id, str(handoff.organization_id))
    except InvalidOrganizationSelection:
        return None

    try:
        flow_instructions = get_flow(handoff.flow).render(
            handoff.context,
            user_id=user.id,
            organization_id=context.organization.id,
        )
    except InvalidHandoffContext:
        return None

    persist_authorization(application, user.id, handoff.scope_list, organization_id)
    _, setup_code = ApiSetupCode.mint(
        application=application,
        user_id=user.id,
        scope_list=handoff.scope_list,
        organization_id=organization_id,
    )
    return render_agent_runbook(
        organization_slug=context.organization.slug,
        organization_name=context.organization.name,
        user_email=user.email,
        sentry_url=options.get("system.url-prefix"),
        client_id=application.client_id,
        setup_code=setup_code,
        flow_instructions=flow_instructions,
    )
