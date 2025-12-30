"""
Handlers should only validate the data and then just schedule a task to process the event.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.webhooks.task import schedule_task

from .config import EVENT_TYPE_TO_CUSTOM_HANDLER

logger = logging.getLogger(__name__)

METRICS_PREFIX = "seer.code_review.webhook"


def handle_webhook_event(
    *,
    event_type: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub webhook events by scheduling a task to process the event if no custom handler is available.

    Args:
        event_type: The type of the webhook event (as string)
        event: The webhook event payload
        organization: The Sentry organization that the webhook event belongs to
        repo: The repository that the webhook event is for
        **kwargs: Additional keyword arguments including integration
    """
    handler = EVENT_TYPE_TO_CUSTOM_HANDLER.get(event_type)
    if handler is None:
        schedule_task(event_type=event_type, event_payload=event)
    else:
        handler(event_type=event_type, event=event, organization=organization, repo=repo, **kwargs)
