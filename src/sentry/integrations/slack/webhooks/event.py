from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Any

import orjson
import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response
from slack_sdk.errors import SlackApiError

from sentry import analytics, features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import all_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
    SeerSlackHaltReason,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.analytics import SlackIntegrationChartUnfurl
from sentry.integrations.slack.integration import SlackIntegration
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.prompt import SlackPromptLinkMessageBuilder
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.event import COMMANDS, SlackEventRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.unfurl.handlers import link_handlers, match_link
from sentry.integrations.slack.unfurl.types import LinkType, UnfurlableUrl
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization, OrganizationStatus
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.entrypoints.slack.entrypoint import SlackExplorerEntrypoint
from sentry.seer.entrypoints.slack.tasks import process_mention_for_slack

from .base import SlackDMEndpoint
from .command import LINK_FROM_CHANNEL_MESSAGE

_logger = logging.getLogger(__name__)

_SEER_LOADING_MESSAGES = [
    "Digging through your errors...",
    "Sifting through stack traces...",
    "Blaming the right code...",
    "Following the breadcrumbs...",
    "Asking the stack trace nicely...",
    "Reading between the stack frames...",
    "Hold on, I've seen this one before...",
    "It worked on my machine...",
]
SLACK_PROVIDERS = [IntegrationProviderSlug.SLACK, IntegrationProviderSlug.SLACK_STAGING]


@all_silo_endpoint  # Only challenge verification is handled at control
class SlackEventEndpoint(SlackDMEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will need refactoring
    """

    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackEventRequest

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            "message": message,
        }
        if slack_request.channel_id is None:
            _logger.info("reply.post-message-error", extra=logger_params)
        else:
            client = SlackSdkClient(integration_id=slack_request.integration.id)
            try:
                client.chat_postMessage(channel=slack_request.channel_id, text=message)
            except SlackApiError:
                _logger.info("reply.post-message-error", extra=logger_params)

        return self.respond()

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def on_url_verification(self, request: Request, data: Mapping[str, str]) -> Response:
        return self.respond({"challenge": data["challenge"]})

    def prompt_link(self, slack_request: SlackDMRequest) -> None:
        associate_url = build_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        if not slack_request.channel_id:
            return

        payload = {
            "channel": slack_request.channel_id,
            "user": slack_request.user_id,
            "text": "Link your Slack identity to Sentry to unfurl Discover charts.",
            **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
        }

        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            **payload,
        }

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        if slack_request.user_id is None:
            _logger.warning("prompt_link.post-ephemeral-error", extra=logger_params)
        else:
            try:
                client.chat_postEphemeral(
                    channel=slack_request.channel_id,
                    user=slack_request.user_id,
                    text=payload["text"],
                    **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
                )
            except SlackApiError:
                _logger.warning("prompt_link.post-ephemeral-error", extra=logger_params)

    def on_message(self, request: Request, slack_request: SlackDMRequest) -> Response:
        command = request.data.get("event", {}).get("text", "").lower()
        if slack_request.is_bot() or not command:
            return self.respond()

        payload = {
            "channel": slack_request.channel_id,
            **SlackHelpMessageBuilder(
                command=command,
                integration_id=slack_request.integration.id,
            ).as_payload(),
        }
        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            **payload,
        }

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        if slack_request.channel_id is None:
            _logger.warning("on_message.post-message-error", extra=logger_params)
        else:
            try:
                client.chat_postMessage(
                    channel=slack_request.channel_id,
                    **SlackHelpMessageBuilder(
                        command=command,
                        integration_id=slack_request.integration.id,
                    ).as_payload(),
                )
            except SlackApiError:
                _logger.warning("on_message.post-message-error", extra=logger_params)

        return self.respond()

    def _get_unfurlable_links(
        self,
        request: Request,
        slack_request: SlackDMRequest,
        data: dict[str, Any],
        organization: RpcOrganization | None,
        logger_params: dict[str, Any],
    ) -> dict[LinkType, list[UnfurlableUrl]]:
        matches: dict[LinkType, list[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()
        link_types: set[str] = set()

        for item in data.get("links", []):
            with MessagingInteractionEvent(
                interaction_type=MessagingInteractionType.PROCESS_SHARED_LINK,
                spec=SlackMessagingSpec(),
            ).capture() as lifecycle:
                try:
                    url = item["url"]
                except Exception:
                    lifecycle.record_failure("Failed to parse link", extra={**logger_params})
                    continue

                link_type, args = match_link(url)

                # Link can't be unfurled
                if link_type is None or args is None:
                    continue

                feature_flag = {
                    LinkType.DISCOVER: "organizations:discover-basic",
                    LinkType.EXPLORE: "organizations:data-browsing-widget-unfurl",
                }.get(link_type)

                if (
                    organization
                    and feature_flag
                    and not slack_request.has_identity
                    and features.has(feature_flag, organization, actor=request.user)
                ):
                    try:
                        analytics.record(
                            SlackIntegrationChartUnfurl(
                                organization_id=organization.id,
                                unfurls_count=0,
                            )
                        )
                    except Exception as e:
                        sentry_sdk.capture_exception(e)

                    self.prompt_link(slack_request)
                    lifecycle.record_halt("Discover link requires identity", extra={"url": url})
                    return {}

                # Don't unfurl the same thing multiple times
                seen_marker = hash(orjson.dumps((link_type, list(args))).decode())
                if seen_marker in links_seen:
                    continue

                links_seen.add(seen_marker)
                matches[link_type].append(UnfurlableUrl(url=url, args=args))
                link_types.add(getattr(link_type, "value", str(link_type)))

        if len(link_types) > 0:
            sentry_sdk.set_tag("slack.link_type", ",".join(sorted(link_types)))

        return matches

    def _unfurl_links(
        self, slack_request: SlackDMRequest, matches: dict[LinkType, list[UnfurlableUrl]]
    ) -> dict[str, Any]:
        results: dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(
                link_handlers[link_type].fn(
                    slack_request.integration, unfurl_data, slack_request.user
                )
            )

        # XXX(isabella): we use our message builders to create the blocks for each link to be
        # unfurled, so the original result will include the fallback text string, however, the
        # unfurl endpoint does not accept fallback text.
        for link_info in results.values():
            if "text" in link_info:
                del link_info["text"]

        return results

    def on_link_shared(self, request: Request, slack_request: SlackDMRequest) -> bool:
        """Returns true on success"""

        data = slack_request.data.get("event", {})

        ois = integration_service.get_organization_integrations(
            integration_id=slack_request.integration.id, limit=1
        )
        organization_id = ois[0].organization_id if len(ois) > 0 else None
        organization_context = (
            organization_service.get_organization_by_id(
                id=organization_id,
                user_id=None,
                include_projects=False,
                include_teams=False,
            )
            if organization_id
            else None
        )
        organization = organization_context.organization if organization_context else None

        if organization:
            sentry_sdk.set_tag("organization.slug", organization.slug)
        identity_user = slack_request.get_identity_user()
        if identity_user:
            sentry_sdk.set_user(
                {
                    "id": str(identity_user.id),
                    "email": identity_user.email,
                    "username": identity_user.username,
                }
            )

        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            "organization_id": organization_id,
            **data,
        }

        # An unfurl may have multiple links to unfurl
        matches = self._get_unfurlable_links(
            request, slack_request, data, organization, logger_params
        )
        if not matches:
            return False

        # Unfurl each link type
        results = self._unfurl_links(slack_request, matches)
        if not results:
            return False

        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.UNFURL_LINK,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            payload = {"channel": data["channel"], "ts": data["message_ts"], "unfurls": results}
            client = SlackSdkClient(integration_id=slack_request.integration.id)
            try:
                client.chat_unfurl(
                    channel=data["channel"],
                    ts=data["message_ts"],
                    unfurls=payload["unfurls"],
                )
            except SlackApiError as e:
                lifecycle.add_extras(logger_params)
                if options.get("slack.log-unfurl-payload", False):
                    lifecycle.add_extra("unfurls", payload["unfurls"])
                lifecycle.record_failure(e)
                return False

        return True

    def _resolve_seer_organization(
        self, slack_request, lifecycle
    ) -> tuple[int, SlackIntegration] | None:
        """Resolve and validate an organization for a Seer Slack event.

        Returns ``(organization_id, installation)`` or ``None`` when the
        event should be halted (the halt reason is already recorded).

        We also check that the requesting user is a member of the organization that Seer is accessing.

        Note: There is a limitation here of only grabbing the first organization with access to Seer.
        If a Slack installation corresponds to multiple organizations with Seer access, this will not work,
        and must be revisited.
        """
        ois = integration_service.get_organization_integrations(
            integration_id=slack_request.integration.id,
            status=ObjectStatus.ACTIVE,
            providers=SLACK_PROVIDERS,
        )
        if not ois:
            lifecycle.record_halt(SeerSlackHaltReason.NO_VALID_INTEGRATION)
            return None

        identity_user = slack_request.get_identity_user()

        lifecycle.add_extra("organization_ids", [oi.organization_id for oi in ois])
        for oi in ois:
            organization_id = oi.organization_id
            try:
                organization = Organization.objects.get_from_cache(id=organization_id)
            except Organization.DoesNotExist:
                continue

            if organization.status != OrganizationStatus.ACTIVE:
                continue

            if not SlackExplorerEntrypoint.has_access(organization):
                continue

            # When the user's identity is linked, verify they belong to this
            # org. If not linked the downstream task will prompt to link.
            if identity_user and not organization.has_access(identity_user):
                continue

            installation = slack_request.integration.get_installation(
                organization_id=organization_id
            )
            assert isinstance(installation, SlackIntegration)

            return organization_id, installation
        lifecycle.record_halt(SeerSlackHaltReason.NO_VALID_ORGANIZATION)
        return None

    def _handle_seer_mention(
        self,
        slack_request: SlackDMRequest,
        interaction_type: MessagingInteractionType,
    ) -> Response | None:
        """Shared handler for app mentions and DMs that trigger the Seer workflow.

        Returns ``None`` when org resolution fails (DM messages only),
        allowing the caller to fall back to alternative handling.
        """
        with MessagingInteractionEvent(
            interaction_type=interaction_type,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            data = slack_request.data.get("event", {})
            lifecycle.add_extras(
                {
                    "integration_id": slack_request.integration.id,
                    "thread_ts": data.get("thread_ts"),
                }
            )

            result = self._resolve_seer_organization(slack_request, lifecycle)
            if result is None:
                # For DMs, return None on org resolution failure so caller
                # can fall back to the help message.
                if interaction_type == MessagingInteractionType.DM_MESSAGE:
                    return None
                return self.respond()
            organization_id, installation = result

            channel_id = data.get("channel")
            text = data.get("text")
            ts = data.get("ts") or data.get("message_ts")
            thread_ts = data.get("thread_ts")

            lifecycle.add_extras(
                {
                    "channel_id": channel_id,
                    "text": text,
                    "ts": ts,
                    "thread_ts": thread_ts,
                    "user_id": slack_request.user_id,
                }
            )

            if not channel_id or not text or not ts or not slack_request.user_id:
                lifecycle.record_halt(SeerSlackHaltReason.MISSING_EVENT_DATA)
                return self.respond()

            try:
                installation.set_thread_status(
                    channel_id=channel_id,
                    thread_ts=thread_ts or ts,
                    status="Thinking...",
                    loading_messages=_SEER_LOADING_MESSAGES,
                )
            except Exception:
                _logger.exception(
                    "slack.assistant_threads_setStatus.failed",
                    extra={
                        "integration_id": slack_request.integration.id,
                        "channel_id": channel_id,
                        "thread_ts": thread_ts or ts,
                    },
                )

            authorizations = slack_request.data.get("authorizations") or []
            bot_user_id = authorizations[0].get("user_id", "") if authorizations else ""

            process_mention_for_slack.apply_async(
                kwargs={
                    "integration_id": slack_request.integration.id,
                    "organization_id": organization_id,
                    "channel_id": channel_id,
                    "ts": ts,
                    "thread_ts": thread_ts,
                    "text": text,
                    "slack_user_id": slack_request.user_id,
                    "bot_user_id": bot_user_id,
                }
            )
            return self.respond()

    def on_app_mention(self, slack_request: SlackDMRequest) -> Response:
        """Handle @mention events for Seer Explorer."""
        return (
            self._handle_seer_mention(slack_request, MessagingInteractionType.APP_MENTION)
            or self.respond()
        )

    def on_dm(self, slack_request: SlackDMRequest) -> Response | None:
        """Handle DM messages via the Seer workflow; returns None to fall back to help."""
        return self._handle_seer_mention(slack_request, MessagingInteractionType.DM_MESSAGE)

    def on_assistant_thread_started(self, slack_request: SlackDMRequest) -> Response:
        """Handle assistant_thread_started events by sending suggested prompts."""
        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.ASSISTANT_THREAD_STARTED,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            data = slack_request.data.get("event", {})
            assistant_thread = data.get("assistant_thread", {})
            lifecycle.add_extra("integration_id", slack_request.integration.id)

            result = self._resolve_seer_organization(slack_request, lifecycle)
            if result is None:
                return self.respond()
            _organization_id, installation = result

            channel_id = assistant_thread.get("channel_id")
            thread_ts = assistant_thread.get("thread_ts")

            lifecycle.add_extras(
                {
                    "channel_id": channel_id,
                    "thread_ts": thread_ts,
                    "context": assistant_thread.get("context"),
                }
            )

            if not channel_id or not thread_ts:
                lifecycle.record_halt(SeerSlackHaltReason.MISSING_EVENT_DATA)
                return self.respond()

            try:
                installation.set_suggested_prompts(
                    channel_id=channel_id,
                    thread_ts=thread_ts,
                    title="Hi there! I'm Seer, Sentry's AI assistant. How can I help?",
                    prompts=[
                        {
                            "title": "Summarize recent issues",
                            "message": "What are the most important unresolved issues in my projects right now?",
                        },
                        {
                            "title": "Investigate an error",
                            "message": "Help me investigate what's causing errors in my project.",
                        },
                        {
                            "title": "Explain a stack trace",
                            "message": "Can you explain the root cause of this stack trace?",
                        },
                        {
                            "title": "Find similar issues",
                            "message": "Are there any similar issues that might be related to each other?",
                        },
                    ],
                )
            except Exception:
                _logger.exception(
                    "slack.assistant_thread_started.set_suggested_prompts_failed",
                    extra={
                        "integration_id": slack_request.integration.id,
                        "channel_id": channel_id,
                        "thread_ts": thread_ts,
                    },
                )

            return self.respond()

    # TODO(dcramer): implement app_uninstalled and tokens_revoked
    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        if slack_request.is_challenge():
            return self.on_url_verification(request, slack_request.data)

        sentry_sdk.set_tag("slack.event_type", slack_request.type)

        if slack_request.type == "link_shared":
            if self.on_link_shared(request, slack_request):
                return self.respond()

        if slack_request.type == "app_mention":
            return self.on_app_mention(slack_request)

        if slack_request.type == "assistant_thread_started":
            return self.on_assistant_thread_started(slack_request)

        if slack_request.type == "message":
            if slack_request.is_bot():
                return self.respond()

            command, _ = slack_request.get_command_and_args()

            resp: Response | None
            if command in COMMANDS:
                resp = super().post_dispatcher(slack_request)
            else:
                # Try the agentic workflow first; falls back to help if feature is off.
                resp = self.on_dm(slack_request) or self.on_message(request, slack_request)

            if resp:
                return resp

        return self.respond()
