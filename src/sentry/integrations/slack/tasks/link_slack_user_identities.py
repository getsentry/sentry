from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.slack.link_slack_user_identities import (
    link_slack_user_identities as old_link_slack_user_identities,
)


@instrumented_task(
    name="sentry.integrations.slack.tasks.link_users_identities",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
    max_retries=3,
)
def link_slack_user_identities(
    integration_id: int,
    organization_id: int,
) -> None:
    old_link_slack_user_identities(integration_id=integration_id, organization_id=organization_id)
