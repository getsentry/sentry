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
    resource_name: str,
    event_name: str,
    organization_id: int,
    payload: dict[str, Any],
) -> None:
    """
    Send a webhook event to all relevant installations for an organization.

    Args:
        resource_name: The resource name (e.g., "seer", "issue", "error")
        event_name: The event name (e.g., "root_cause_started", "created")
        organization_id: The ID of the organization to send webhooks for
        payload: The webhook payload data

    Returns:
        dict: Status of the webhook sending operation including success status,
              message, and error details if applicable
    """
    # Construct full event type for validation
    event_type = f"{resource_name}.{event_name}"

    # Validate event type by checking if it's a valid SentryAppEventType
    try:
        SentryAppEventType(event_type)
    except ValueError:
        logger.exception("Webhook received invalid event type: %s", event_type)
        raise SentryAppSentryError(
            message=f"Invalid event type: {event_type}",
        )

    # Get installations for this organization
    installations = app_service.installations_for_organization(organization_id=organization_id)

    # Filter for installations that subscribe to the event category
    relevant_installations = [
        installation
        for installation in installations
        if resource_name in consolidate_events(installation.sentry_app.events)
    ]

    if not relevant_installations:
        logger.info(
            "No installations subscribed to '%s' events for organization %s",
            resource_name,
            organization_id,
        )
        return

    # Send the webhook to each relevant installation
    for installation in relevant_installations:
        if not installation:
            raise SentryAppSentryError(
                message=f"{SentryAppWebhookFailureReason.MISSING_INSTALLATION}"
            )

        send_webhooks(installation, event_type, data=payload)

        logger.info("Queued webhook for %s to installation %s", event_type, installation.id)
