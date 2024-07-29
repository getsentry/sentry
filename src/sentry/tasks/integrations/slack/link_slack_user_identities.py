from __future__ import annotations

from sentry.integrations.tasks.slack.link_slack_user_identities import (
    link_slack_user_identities as new_link_slack_user_identities,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.integrations.slack.link_users_identities",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
    max_retries=3,
)
def link_slack_user_identities(
    integration_id: int,
    organization_id: int,
) -> None:
    new_link_slack_user_identities(integration_id, organization_id)
