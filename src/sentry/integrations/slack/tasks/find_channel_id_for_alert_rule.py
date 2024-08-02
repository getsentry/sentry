from typing import Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.slack.find_channel_id_for_alert_rule import (
    find_channel_id_for_alert_rule as old_find_channel_id_for_alert_rule,
)


@instrumented_task(
    name="sentry.integrations.slack.tasks.search_channel_id_for_alert_rule",
    queue="integrations",
    silo_mode=SiloMode.REGION,
)
def find_channel_id_for_alert_rule(
    organization_id: int,
    uuid: str,
    data: Any,
    alert_rule_id: int | None = None,
    user_id: int | None = None,
) -> None:
    old_find_channel_id_for_alert_rule(
        organization_id=organization_id,
        uuid=uuid,
        data=data,
        alert_rule_id=alert_rule_id,
        user_id=user_id,
    )
