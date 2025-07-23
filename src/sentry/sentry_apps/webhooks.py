"""
Webhook broadcasting utilities for Sentry applications.
"""

import logging
from typing import Any

from sentry.sentry_apps.logic import consolidate_events
from sentry.sentry_apps.metrics import SentryAppEventType, SentryAppWebhookFailureReason
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.tasks.sentry_apps import send_webhooks
from sentry.sentry_apps.utils.errors import SentryAppSentryError

logger = logging.getLogger(__name__)


def broadcast_webhooks_for_organization(
    *,
    event_type: str,
    organization_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Send a webhook event to all relevant installations for an organization.

    Args:
        event_type: The type of event (e.g., "seer.issue.root_cause_started")
        organization_id: The ID of the organization to send webhooks for
        payload: The webhook payload data
        event_category: Optional event category to filter installations by.
                       If provided, only installations subscribed to this category will receive the webhook.
                       If None, the category is inferred from the event_type prefix.

    Returns:
        dict: Status of the webhook sending operation including success status,
              message, and error details if applicable
    """
    # Validate event type by checking if it's a valid SentryAppEventType
    valid_events = [member.value for member in SentryAppEventType]
    if event_type not in valid_events:
        logger.error("Webhook received invalid event type: %s", event_type)
        return {
            "success": False,
            "error": f"Invalid event type: {event_type}",
        }

    # Determine event category from event_type
    event_category = event_type.split(".", 1)[0] if "." in event_type else event_type

    # Get installations for this organization
    installations = app_service.installations_for_organization(organization_id=organization_id)

    # Filter for installations that subscribe to the event category
    relevant_installations = [
        installation
        for installation in installations
        if event_category in consolidate_events(installation.sentry_app.events)
    ]

    if not relevant_installations:
        logger.info(
            "No installations subscribed to '%s' events for organization %s",
            event_category,
            organization_id,
        )
        return {
            "success": True,
            "message": f"No installations subscribed to {event_category} events",
        }

    # Send the webhook to each relevant installation
    for installation_id in relevant_installations:
        installation = app_service.installation_by_id(id=installation_id)
        if not installation:
            raise SentryAppSentryError(
                message=f"{SentryAppWebhookFailureReason.MISSING_INSTALLATION}"
            )

        send_webhooks(installation, event_type, data=payload)

        logger.info("Queued webhook for %s to installation %s", event_type, installation.id)
