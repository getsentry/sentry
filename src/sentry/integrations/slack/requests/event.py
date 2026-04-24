from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, NamedTuple

from sentry.constants import ObjectStatus
from sentry.identity.services.identity import RpcIdentity
from sentry.identity.services.identity.service import identity_service
from sentry.identity.slack.provider import PREFERRED_ORGANIZATION_ID_KEY
from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.unfurl.handlers import match_link
from sentry.integrations.slack.unfurl.types import LinkType
from sentry.integrations.slack.utils.constants import SlackScope
from sentry.integrations.slack.workspace import get_thread_history
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmember import InviteStatus
from sentry.organizations.services.organization.model import RpcUserOrganizationContext
from sentry.organizations.services.organization.service import organization_service
from sentry.seer.entrypoints.slack.entrypoint import SlackAgentEntrypoint
from sentry.seer.entrypoints.slack.mention import _SLACK_URL_RE, build_thread_context
from sentry.silo.base import SiloMode, all_silo_function
from sentry.users.services.user.service import user_service

COMMANDS = ["link", "unlink", "link team", "unlink team"]
SLACK_PROVIDERS = [IntegrationProviderSlug.SLACK, IntegrationProviderSlug.SLACK_STAGING]

logger = logging.getLogger(__name__)


def has_discover_links(links: list[str]) -> bool:
    return any(match_link(link)[0] == LinkType.DISCOVER for link in links)


def has_explore_links(links: list[str]) -> bool:
    return any(match_link(link)[0] == LinkType.EXPLORE for link in links)


def is_event_challenge(data: Mapping[str, Any]) -> bool:
    return data.get("type", "") == "url_verification"


class SeerResolutionResult(NamedTuple):
    organization_id: int | None
    halt_reason: SeerSlackHaltReason | None


@all_silo_function
def _resolve_available_organizations(
    *, user_id: int, organization_ids: list[int], logging_ctx: dict[str, Any]
) -> list[RpcUserOrganizationContext]:
    """
    Gets all organizations that adhere to the following:
    - the organization exists
    - the organization is active
    - the user has access to the organization
    - the organization has access to Seer Agent in Slack (varies based on SiloMode)
    """
    available_organizations = []
    for organization_id in organization_ids:
        ctx = organization_service.get_organization_by_id(id=organization_id, user_id=user_id)
        logging_ctx["current_organization_id"] = organization_id
        if ctx is None:
            logger.info("_resolve_available_organizations.no_rpc_response", extra=logging_ctx)
            continue

        if ctx.organization.status != OrganizationStatus.ACTIVE:
            logger.info("_resolve_available_organizations.inactive_org", extra=logging_ctx)
            continue

        # Since the getsentry FeatureHandler does _not_ add subscription context to CONTROL
        # evaluations, we need to slim down the check to only cover the feature flag.
        # This is actually fine, since after routing, this method is rerun at the CELL.
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            if not SlackAgentEntrypoint.has_feature_flag(ctx.organization):
                logger.info("_resolve_available_organizations.no_feature_flag", extra=logging_ctx)
                continue
        else:
            if not SlackAgentEntrypoint.has_access(ctx.organization):
                logger.info("_resolve_available_organizations.no_access", extra=logging_ctx)
                continue

        if ctx.member is None:
            logger.info("_resolve_available_organizations.missing_membership", extra=logging_ctx)
            continue

        if ctx.member.invite_status != InviteStatus.APPROVED.value:
            logger.info("_resolve_available_organizations.unapproved_membership", extra=logging_ctx)
            continue

        logger.info("_resolve_available_organizations.success", extra=logging_ctx)
        available_organizations.append(ctx)
    return available_organizations


def _resolve_organization_from_text(
    *, search_text: str, available_organizations: list[RpcUserOrganizationContext]
) -> RpcUserOrganizationContext | None:
    """
    Resolves an organization from the initial message text by looking for Sentry issue links and
    matching its org slug against the available organizations. Returns the first match.
    """
    organizations_by_slug = {ctx.organization.slug: ctx for ctx in available_organizations}
    for url in _SLACK_URL_RE.findall(search_text):
        _, args = match_link(url)
        if not args or "org_slug" not in args:
            continue
        ctx = organizations_by_slug.get(args["org_slug"])
        if ctx is not None:
            return ctx
    return None


def _resolve_organization_from_preference(
    *,
    identity: RpcIdentity,
    available_organizations: list[RpcUserOrganizationContext],
) -> RpcUserOrganizationContext | None:
    """
    Resolves an organization from the user's stored preference on their Identity. Returns None if
    no preference is set, or if the preferred org is not currently available to the user.
    """
    preferred_id = identity.data.get(PREFERRED_ORGANIZATION_ID_KEY)
    if not preferred_id:
        return None
    for ctx in available_organizations:
        if ctx.organization.id == preferred_id:
            return ctx
    return None


def _resolve_organization_from_thread(
    *,
    integration: RpcIntegration,
    channel_id: str,
    thread_ts: str,
    available_organizations: list[RpcUserOrganizationContext],
) -> RpcUserOrganizationContext | None:
    """
    Resolves an organization from a thread by looking for Sentry issue links starting with the
    earliest message and matching its org slug against the available organizations. Returns the
    first match.
    """
    if not channel_id or not thread_ts:
        return None
    thread_messages = get_thread_history(
        integration_id=integration.id,
        channel_id=channel_id,
        thread_ts=thread_ts,
        scopes=integration.metadata.get("scopes"),
    )
    thread_context = build_thread_context(thread_messages)
    return _resolve_organization_from_text(
        search_text=thread_context, available_organizations=available_organizations
    )


@all_silo_function
def resolve_seer_organization(
    *,
    integration: RpcIntegration,
    slack_user_id: str,
    channel_id: str,
    thread_ts: str,
    message_ts: str,
    event_type: str,
    message_text: str,
) -> SeerResolutionResult:
    """
    Resolve and validate an organization/user for a Seer Slack event.

    We require a linked identity, then search for an active, organization they belong to with
    Seer Agent access.

    Note: There is a limitation here of only grabbing the first organization belonging to the user
    with access to Seer. If a Slack installation corresponds to multiple organizations with Seer
    access, this will not work as expected. This will be revisited.
    """
    logging_ctx = {
        "integration_id": integration.id,
        "slack_user_id": slack_user_id,
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "message_ts": message_ts,
        "event_type": event_type,
        "silo_mode": SiloMode.get_current_mode().value,
    }
    provider = identity_service.get_provider(
        provider_type=integration.provider, provider_ext_id=integration.external_id
    )
    identity = (
        identity_service.get_identity(
            filter={"provider_id": provider.id, "identity_ext_id": slack_user_id}
        )
        if provider
        else None
    )
    user = user_service.get_user(identity.user_id) if identity else None
    if not identity or not user:
        logger.info("resolve_seer_organization.identity_not_linked", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=None, halt_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )

    ois = integration_service.get_organization_integrations(
        integration_id=integration.id,
        status=ObjectStatus.ACTIVE,
        providers=SLACK_PROVIDERS,
    )
    if not ois:
        logger.info("resolve_seer_organization.no_valid_integration", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=None, halt_reason=SeerSlackHaltReason.NO_VALID_INTEGRATION
        )

    organization_ids = [oi.organization_id for oi in ois]
    logging_ctx["organization_ids"] = organization_ids

    available_organizations = _resolve_available_organizations(
        user_id=user.id, organization_ids=organization_ids, logging_ctx=logging_ctx
    )
    logging_ctx["organization_slugs"] = [ctx.organization.slug for ctx in available_organizations]
    if not available_organizations:
        logger.info("resolve_seer_organization.no_valid_organization", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=None, halt_reason=SeerSlackHaltReason.NO_VALID_ORGANIZATION
        )

    if len(available_organizations) == 1:
        logger.info("resolve_seer_organization.single_organization", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=available_organizations[0].organization.id, halt_reason=None
        )

    # If multiple organization are available, we follow a staged resolution approach:
    # 1. Check the initial message for an organization identifier
    ctx_from_message = _resolve_organization_from_text(
        search_text=message_text, available_organizations=available_organizations
    )
    if ctx_from_message is not None:
        logger.info("resolve_seer_organization.resolved_from_message", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=ctx_from_message.organization.id, halt_reason=None
        )

    # 2. Check the entire thread for an organization identifier
    ctx_from_thread = _resolve_organization_from_thread(
        integration=integration,
        channel_id=channel_id,
        thread_ts=thread_ts,
        available_organizations=available_organizations,
    )
    if ctx_from_thread is not None:
        logger.info("resolve_seer_organization.resolved_from_thread", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=ctx_from_thread.organization.id, halt_reason=None
        )

    # 3. Check the user's preferred organization
    ctx_from_preference = _resolve_organization_from_preference(
        identity=identity, available_organizations=available_organizations
    )
    if ctx_from_preference is not None:
        logger.info("resolve_seer_organization.resolved_from_preference", extra=logging_ctx)
        return SeerResolutionResult(
            organization_id=ctx_from_preference.organization.id, halt_reason=None
        )

    # 4. Fallback to the first result
    first_organization = available_organizations[0]
    logger.info("resolve_seer_organization.fallback_organization", extra=logging_ctx)
    return SeerResolutionResult(
        organization_id=first_organization.organization.id, halt_reason=None
    )


class SlackEventRequest(SlackDMRequest):
    """
    An Event request sent from Slack.

    These requests require the same Data and Token validation as all other
    requests from Slack, but also event data validation.

    Challenge Requests
    ------------------
    Slack Event requests first start with a "challenge request". This is just a
    request Sentry needs to verifying using it's shared key.

    Challenge requests will have a ``type`` of ``url_verification``.
    """

    def validate(self) -> None:
        if self.is_challenge():
            # Challenge requests only include the Token and data to verify the
            # request, so only validate those.
            self._info("slack.event.url_verification")
            self.authorize()
            super(SlackDMRequest, self)._validate_data()
        else:
            # Non-Challenge requests need to validate everything plus the data
            # about the event.
            super().validate()
            self._validate_event()

    def is_challenge(self) -> bool:
        """We need to call this before validation."""
        return is_event_challenge(self.request.data)

    @property
    def is_seer_agent_request(self) -> bool:
        return (
            self.type == "app_mention"
            or self.type == "assistant_thread_started"
            or (self.dm_data.get("type") == "message" and self.has_assistant_scope)
        )

    @all_silo_function
    def resolve_seer_organization(self) -> SeerResolutionResult:
        return resolve_seer_organization(
            integration=self.integration,
            slack_user_id=self.user_id,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            message_ts=self.dm_data.get("ts", ""),
            event_type=self.dm_data.get("type", ""),
            message_text=self.text,
        )

    @property
    def dm_data(self) -> Mapping[str, Any]:
        return self.data.get("event", {})

    @property
    def channel_id(self) -> str:
        if self.is_assistant_thread_event:
            return self.dm_data.get("assistant_thread", {}).get("channel_id", "")
        return self.dm_data.get("channel", "")

    @property
    def user_id(self) -> str:
        if self.is_assistant_thread_event:
            return self.dm_data.get("assistant_thread", {}).get("user_id", "")
        return self.dm_data.get("user", "")

    @property
    def thread_ts(self) -> str:
        if self.is_assistant_thread_event:
            return self.dm_data.get("assistant_thread", {}).get("thread_ts", "")
        return self.dm_data.get("thread_ts", "")

    @property
    def has_assistant_scope(self) -> bool:
        return SlackScope.ASSISTANT_WRITE in self.integration.metadata.get("scopes", [])

    @property
    def is_assistant_thread_event(self) -> bool:
        return self.dm_data.get("type") == "assistant_thread_started"

    @property
    def links(self) -> list[str]:
        return [link["url"] for link in self.dm_data.get("links", []) if "url" in link]

    def _validate_event(self) -> None:
        if not self.dm_data:
            self._error("slack.event.invalid-event-data")
            raise SlackRequestError(status=400)

        if not self.dm_data.get("type"):
            self._error("slack.event.invalid-event-type")
            raise SlackRequestError(status=400)

    def validate_integration(self) -> None:
        super().validate_integration()

        if (self.text in COMMANDS) or (
            self.type == "link_shared"
            and (has_discover_links(self.links) or has_explore_links(self.links))
        ):
            self._validate_identity()

    def _log_request(self) -> None:
        self._info(f"slack.event.{self.type}")

    def is_bot(self) -> bool:
        return bool(self.dm_data.get("bot_id"))
