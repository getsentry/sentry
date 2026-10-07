import orjson

from sentry import features
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction, SlackBlock
from sentry.models.organization import Organization
from sentry.notifications.utils.actions import MessageAction


def should_show_investigation_button(
    organization: Organization, new_status: IncidentStatus
) -> bool:
    return (
        new_status != IncidentStatus.CLOSED
        and features.has("organizations:investigations", organization)
        and features.has("organizations:investigations-slack", organization)
    )


def build_investigation_block(
    *, organization_id: int, project_id: int, group_id: int, open_period_id: int
) -> SlackBlock:
    button = BlockSlackMessageBuilder.get_button_action(
        MessageAction(
            name="investigate_with_seer",
            label="Investigate with Seer",
            value=orjson.dumps({"groupId": group_id, "openPeriodId": open_period_id}).decode(),
            action_id=encode_action_id(
                action=SlackAction.SEER_INVESTIGATION_START,
                organization_id=organization_id,
                project_id=project_id,
            ),
        )
    )
    return {"type": "actions", "elements": [button]}
