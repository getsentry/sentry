import logging
from typing import Any

import orjson
from django.db import IntegrityError
from requests.exceptions import RequestException
from slack_sdk.errors import SlackApiError
from slack_sdk.models.views import View

from sentry import features
from sentry.api.endpoints.organization_monitoring_provider_index import (
    MONITORING_PROVIDERS,
)
from sentry.auth.exceptions import IdentityNotValid
from sentry.identity import default_manager as identity_manager
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.services.identity import identity_service
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.organizations.services.organization import organization_service
from sentry.users.models.identity import link_provider_identity
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

MONITORING_PROVIDER_CALLBACK_ID = "monitoring_provider_connect"


def open_monitoring_provider_modal(
    slack_request: SlackActionRequest,
    provider_key: str,
    *,
    channel_id: str | None = None,
    thread_ts: str | None = None,
    run_id: str | None = None,
) -> str | None:
    """Open the PAT modal for a monitoring provider. Returns an error message or None on success."""
    identity_user = slack_request.get_identity_user()
    if not identity_user:
        return "You need to link your Sentry identity first. Use `/sentry link` to get started."

    orgs = _get_orgs_with_feature(identity_user.id, slack_request.integration.id)
    if not orgs:
        return "None of your organizations have infrastructure monitoring enabled."

    if provider_key not in MONITORING_PROVIDERS:
        return f"Unknown monitoring provider: `{provider_key}`."

    provider_type = identity_manager.get(provider_key)
    if isinstance(provider_type, OAuth2Provider):
        return f"`{provider_key}` uses OAuth and is not yet supported from Slack."

    trigger_id = slack_request.data.get("trigger_id")
    if not trigger_id:
        logger.warning(
            "slack.monitoring_provider.no_trigger_id",
            extra={"integration_id": slack_request.integration.id},
        )
        return "Unable to open the connection dialog. Please try again."

    modal = build_monitoring_provider_modal(
        provider_key=provider_key,
        orgs=orgs,
        channel_id=channel_id or slack_request.channel_id,
        thread_ts=thread_ts,
        run_id=run_id,
    )

    slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
    try:
        slack_client.views_open(trigger_id=trigger_id, view=modal)
    except SlackApiError:
        logger.exception("slack.monitoring_provider.views_open_failed")
        return "Unable to open the connection dialog. Please try again."
    return None


def build_monitoring_provider_modal(
    provider_key: str,
    orgs: list[tuple[int, str]],
    channel_id: str | None,
    thread_ts: str | None,
    run_id: str | None,
) -> View:
    """Build a Slack modal View for PAT-based monitoring provider connection."""
    provider_meta = MONITORING_PROVIDERS.get(provider_key, {})
    provider_name = provider_meta.get("name", provider_key)

    blocks: list[dict[str, Any]] = []

    if len(orgs) > 1:
        org_options = [
            {
                "text": {"type": "plain_text", "text": slug},
                "value": str(org_id),
            }
            for org_id, slug in orgs
        ]
        blocks.append(
            {
                "type": "input",
                "block_id": "org_block",
                "label": {"type": "plain_text", "text": "Organization"},
                "element": {
                    "type": "static_select",
                    "action_id": "org_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an organization",
                    },
                    "options": org_options,
                },
            }
        )

    sites: dict[str, str] | None = provider_meta.get("sites")
    if sites:
        site_options = [
            {
                "text": {
                    "type": "plain_text",
                    "text": f"{site} ({region})" if region else site,
                },
                "value": site,
            }
            for site, region in sorted(sites.items())
        ]
        blocks.append(
            {
                "type": "input",
                "block_id": "site_block",
                "label": {"type": "plain_text", "text": "Site"},
                "element": {
                    "type": "static_select",
                    "action_id": "site_select",
                    "options": site_options,
                    "initial_option": site_options[0],
                },
            }
        )

    token_block: dict[str, Any] = {
        "type": "input",
        "block_id": "token_block",
        "label": {"type": "plain_text", "text": "Personal Access Token"},
        "element": {
            "type": "plain_text_input",
            "action_id": "token_input",
            "placeholder": {
                "type": "plain_text",
                "text": "Paste your access token here",
            },
        },
    }
    pat_hint = provider_meta.get("pat_hint")
    if pat_hint:
        token_block["hint"] = {"type": "plain_text", "text": pat_hint}
    blocks.append(token_block)

    private_metadata = orjson.dumps(
        {
            "provider_key": provider_key,
            "org_id": orgs[0][0] if len(orgs) == 1 else None,
            "channel_id": channel_id,
            "thread_ts": thread_ts,
            "run_id": run_id,
        }
    ).decode()

    return View(
        type="modal",
        title={"type": "plain_text", "text": f"Connect {provider_name}"},
        submit={"type": "plain_text", "text": "Connect"},
        close={"type": "plain_text", "text": "Cancel"},
        callback_id=MONITORING_PROVIDER_CALLBACK_ID,
        private_metadata=private_metadata,
        blocks=blocks,
    )


def handle_monitoring_provider_submission(
    slack_request: SlackActionRequest,
) -> dict[str, Any] | None:
    """
    Handle a monitoring provider modal view_submission.

    Returns a dict ``{"response_action": "errors", ...}`` to show validation
    errors inside the modal, or ``None`` on success.
    """
    view = slack_request.data.get("view", {})
    private_metadata = orjson.loads(view.get("private_metadata", "{}"))
    provider_key = private_metadata.get("provider_key")
    channel_id = private_metadata.get("channel_id")

    if not provider_key or provider_key not in MONITORING_PROVIDERS:
        logger.error(
            "slack.monitoring_provider.invalid_provider",
            extra={"private_metadata": private_metadata},
        )
        return None

    identity_user = slack_request.get_identity_user()
    if not identity_user:
        return {
            "response_action": "errors",
            "errors": {
                "token_block": "Your Sentry identity is no longer linked. Use /sentry link and try again."
            },
        }

    state_values = get_path(view, "state", "values", default={})

    org_id = private_metadata.get("org_id")
    if not org_id:
        selected = get_path(state_values, "org_block", "org_select", "selected_option")
        if not selected:
            return {
                "response_action": "errors",
                "errors": {"org_block": "Please select an organization."},
            }
        org_id = int(selected["value"])

    org_ctx = organization_service.get_organization_by_id(id=org_id, user_id=identity_user.id)
    if org_ctx is None or org_ctx.member is None:
        return {
            "response_action": "errors",
            "errors": {"org_block": "You do not have access to this organization."},
        }

    oi = integration_service.get_organization_integration(
        organization_id=org_id, integration_id=slack_request.integration.id
    )
    if oi is None:
        return {
            "response_action": "errors",
            "errors": {"org_block": "This organization is not connected to this Slack workspace."},
        }

    if not features.has("organizations:seer-infra-telemetry", org_ctx.organization, actor=None):
        return {
            "response_action": "errors",
            "errors": {
                "org_block": "This organization does not have infrastructure monitoring enabled."
            },
        }

    site = get_path(state_values, "site_block", "site_select", "selected_option", "value")

    access_token = (
        get_path(state_values, "token_block", "token_input", "value", default="")
    ).strip()
    if not access_token:
        return {
            "response_action": "errors",
            "errors": {"token_block": "Access token is required."},
        }

    provider_type = identity_manager.get(provider_key)
    build_data: dict[str, Any] = {"access_token": access_token}
    if site:
        build_data["site"] = site

    try:
        identity_data = provider_type.build_identity(build_data)
    except (ValueError, IdentityNotValid) as e:
        return {
            "response_action": "errors",
            "errors": {"token_block": str(e)},
        }
    except RequestException:
        return {
            "response_action": "errors",
            "errors": {"token_block": "Failed to verify token with provider."},
        }

    try:
        link_provider_identity(
            user=identity_user,
            identity_data=identity_data,
            organization_id=org_id,
        )
    except IntegrityError:
        return {
            "response_action": "errors",
            "errors": {"token_block": "This account is already connected."},
        }

    _clear_declined_provider(slack_request, provider_key)

    try:
        _send_success_ephemeral(
            slack_request=slack_request,
            provider_key=provider_key,
            channel_id=channel_id,
            thread_ts=private_metadata.get("thread_ts"),
        )
    except SlackApiError:
        logger.exception("slack.monitoring_provider.ephemeral_failed")

    return None


def _clear_declined_provider(slack_request: SlackActionRequest, provider_key: str) -> None:
    """Remove a provider from the Slack Identity's declined list."""
    slack_identity_rpc = slack_request.get_identity()
    if not slack_identity_rpc:
        return
    data = dict(slack_identity_rpc.data) if slack_identity_rpc.data else {}
    declined = set(data.get("declined_monitoring_providers", []))
    if provider_key not in declined:
        return
    declined.discard(provider_key)
    data["declined_monitoring_providers"] = sorted(declined)
    identity_service.update_data(identity_id=slack_identity_rpc.id, data=data)


def _send_success_ephemeral(
    *,
    slack_request: SlackActionRequest,
    provider_key: str,
    channel_id: str | None,
    thread_ts: str | None = None,
) -> None:
    """Send an ephemeral success message after connecting a provider."""
    provider_meta = MONITORING_PROVIDERS.get(provider_key, {})
    provider_name = provider_meta.get("name", provider_key)
    user_id = slack_request.user_id

    if not channel_id or not user_id:
        return

    kwargs: dict[str, Any] = {
        "channel": channel_id,
        "user": user_id,
        "text": f"Connected {provider_name}. Seer can now query {provider_name} data in this org.",
    }
    if thread_ts:
        kwargs["thread_ts"] = thread_ts

    slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
    slack_client.chat_postEphemeral(**kwargs)


def _get_orgs_with_feature(user_id: int, integration_id: int) -> list[tuple[int, str]]:
    """Return (org_id, org_slug) pairs where the org has seer-infra-telemetry enabled."""
    ois = integration_service.get_organization_integrations(integration_id=integration_id)
    result: list[tuple[int, str]] = []
    for oi in ois:
        ctx = organization_service.get_organization_by_id(id=oi.organization_id, user_id=user_id)
        if ctx is None or ctx.member is None:
            continue
        if features.has("organizations:seer-infra-telemetry", ctx.organization, actor=None):
            result.append((ctx.organization.id, ctx.organization.slug))
    return result
