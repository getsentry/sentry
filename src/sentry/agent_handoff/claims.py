from django.views.decorators.debug import sensitive_variables

from sentry import analytics, options
from sentry.agent_handoff.applications import get_handoff_application
from sentry.agent_handoff.codes import consume_handoff
from sentry.agent_handoff.flows import get_flow
from sentry.agent_handoff.flows.base import InvalidHandoffContext
from sentry.agent_handoff.runbook import render_agent_runbook
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


@sensitive_variables()
def claim_handoff(code: str, *, ip_address: str | None) -> str | None:
    """Consume a handoff and render credentials after revalidating its authorization."""
    handoff = consume_handoff(code, ip_address=ip_address)
    if handoff is None:
        return None

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
            flow=handoff.flow,
        )
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
