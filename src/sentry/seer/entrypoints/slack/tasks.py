from __future__ import annotations

import logging

from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.seer.entrypoints.slack.process_mention_for_slack",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
)
def process_mention_for_slack(
    *,
    integration_id: int,
    organization_id: int,
    channel_id: str,
    thread_ts: str | None,
    message_ts: str,
    text: str,
    slack_user_id: str,
) -> None:
    """
    Process a Slack @mention for Seer Explorer.

    Parses the mention, extracts issue links and thread context,
    and triggers an Explorer run.

    TODO(ISWF-2023): Implement full processing logic.
    """
    logger.info(
        "seer.explorer.slack.process_mention",
        extra={
            "integration_id": integration_id,
            "organization_id": organization_id,
            "channel_id": channel_id,
            "thread_ts": thread_ts,
            "message_ts": message_ts,
            "slack_user_id": slack_user_id,
        },
    )
