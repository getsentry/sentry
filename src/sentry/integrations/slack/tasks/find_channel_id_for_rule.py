from collections.abc import Sequence
from typing import Any

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations.slack.find_channel_id_for_rule import (
    find_channel_id_for_rule as old_find_channel_id_for_rule,
)


@instrumented_task(
    name="sentry.integrations.slack.tasks.search_channel_id_for_rule",
    queue="integrations",
    silo_mode=SiloMode.REGION,
)
def find_channel_id_for_rule(
    project: Project,
    actions: Sequence[AlertRuleTriggerAction],
    uuid: str,
    rule_id: int | None = None,
    user_id: int | None = None,
    **kwargs: Any,
) -> None:
    old_find_channel_id_for_rule(
        project=project, actions=actions, uuid=uuid, rule_id=rule_id, user_id=user_id, **kwargs
    )
