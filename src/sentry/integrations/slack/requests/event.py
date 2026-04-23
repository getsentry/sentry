from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, NamedTuple

from sentry.constants import ObjectStatus
from sentry.identity.services.identity.service import identity_service
from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.unfurl.handlers import match_link
from sentry.integrations.slack.unfurl.types import LinkType
from sentry.integrations.slack.utils.constants import SlackScope
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import OrganizationStatus
from sentry.organizations.services.organization.service import organization_service
from sentry.seer.entrypoints.slack.entrypoint import SlackAgentEntrypoint
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
def resolve_seer_organization_for_slack_user(
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
    if not user:
        return SeerResolutionResult(
            organization_id=None, halt_reason=SeerSlackHaltReason.IDENTITY_NOT_LINKED
        )

    ois = integration_service.get_organization_integrations(
        integration_id=integration.id,
        status=ObjectStatus.ACTIVE,
        providers=SLACK_PROVIDERS,
    )
    if not ois:
        return SeerResolutionResult(
            organization_id=None, halt_reason=SeerSlackHaltReason.NO_VALID_INTEGRATION
        )

    logging_ctx["organization_ids"] = [oi.organization_id for oi in ois]
    for oi in ois:
        organization_id = oi.organization_id
        ctx = organization_service.get_organization_by_id(id=oi.organization_id, user_id=user.id)
        logging_ctx["current_organization_id"] = oi.organization_id
        if ctx is None:
            logger.info("resolve_seer_organization.no_rpc_response", extra=logging_ctx)
            continue

        if ctx.organization.status != OrganizationStatus.ACTIVE:
            logger.info("resolve_seer_organization.inactive_org", extra=logging_ctx)
            continue

        # Since the getsentry FeatureHandler does _not_ add subscription context to CONTROL
        # evaluations, we need to slim down the check to only cover the feature flag.
        # This is actually fine, since after routing, this method is rerun at the CELL.
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            if not SlackAgentEntrypoint.has_feature_flag(ctx.organization):
                logger.info("resolve_seer_organization.no_feature_flag", extra=logging_ctx)
                continue
        else:
            if not SlackAgentEntrypoint.has_access(ctx.organization):
                logger.info("resolve_seer_organization.no_access", extra=logging_ctx)
                continue

        if ctx.member is None:
            logger.info("resolve_seer_organization.missing_membership", extra=logging_ctx)
            continue

        logger.info("resolve_seer_organization.success", extra=logging_ctx)
        return SeerResolutionResult(organization_id=organization_id, halt_reason=None)

    logger.info("resolve_seer_organization.no_organization", extra=logging_ctx)
    return SeerResolutionResult(
        organization_id=None, halt_reason=SeerSlackHaltReason.NO_VALID_ORGANIZATION
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
        return resolve_seer_organization_for_slack_user(
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
