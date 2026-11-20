from collections.abc import Sequence
from dataclasses import dataclass

from sentry.constants import ObjectStatus
from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.workflow_engine.models import Action, DataConditionGroupAction


@dataclass(frozen=True)
class SlackChannel:
    integration_id: int
    channel_id: str
    channel_name: str


def get_slack_channels(configs: Sequence[SeerWorkflowConfig]) -> dict[int, SlackChannel]:
    config_ids = {
        config.backing_workflow_id: config.id
        for config in configs
        if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        and config.backing_workflow_id is not None
    }
    rows = DataConditionGroupAction.objects.filter(
        condition_group__workflowdataconditiongroup__workflow_id__in=config_ids,
        action__type=Action.Type.SLACK,
        condition_group__dataconditiongroupaction__action__type=Action.Type.SEER_INVESTIGATION,
        condition_group__workflowdataconditiongroup__workflow__status=ObjectStatus.ACTIVE,
    ).values_list(
        "condition_group__workflowdataconditiongroup__workflow_id",
        "action__integration_id",
        "action__config",
    )
    return {
        config_ids[workflow_id]: SlackChannel(
            integration_id, data["target_identifier"], data["target_display"]
        )
        for workflow_id, integration_id, data in rows
        if integration_id is not None
    }
