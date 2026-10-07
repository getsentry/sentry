import orjson

from sentry import features
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import MetricIssueContext
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction, SlackBlock
from sentry.models.organization import Organization
from sentry.notifications.utils.actions import MessageAction


def build_investigation_block(
    organization: Organization,
    metric_issue_context: MetricIssueContext,
    open_period_id: int | None,
) -> SlackBlock | None:
    group = metric_issue_context.group
    if (
        group is None
        or open_period_id is None
        or metric_issue_context.new_status == IncidentStatus.CLOSED
        or not features.has("organizations:investigations", organization)
        or not features.has("organizations:investigations-slack", organization)
    ):
        return None

    button = BlockSlackMessageBuilder.get_button_action(
        MessageAction(
            name="investigate_with_seer",
            label="Investigate with Seer",
            value=orjson.dumps({"groupId": group.id, "openPeriodId": open_period_id}).decode(),
            action_id=encode_action_id(
                action=SlackAction.SEER_INVESTIGATION_START,
                organization_id=organization.id,
                project_id=group.project_id,
            ),
        )
    )
    return {"type": "actions", "elements": [button]}
