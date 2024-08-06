from typing import Any

from sentry.integrations.slack.tasks.find_channel_id_for_alert_rule import (
    find_channel_id_for_alert_rule as new_find_channel_id_for_alert_rule,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.integrations.slack.search_channel_id_metric_alerts",
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
    new_find_channel_id_for_alert_rule(
        organization_id=organization_id,
        uuid=uuid,
        data=data,
        alert_rule_id=alert_rule_id,
        user_id=user_id,
    )
