from django.conf import settings
from slack_sdk.models.blocks import ActionsBlock, ButtonElement, MarkdownBlock

from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import SeerAgentWriteApproval
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class SeerAgentWriteApprovalSlackRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAgentWriteApproval):
            raise ValueError(
                f"SeerAgentWriteApprovalSlackRenderer does not support {data.__class__.__name__}"
            )

        scope_descriptions = {
            scope: description
            for scope_set in settings.SENTRY_SCOPE_SETS
            for scope, description in scope_set
        }
        scope_lines = "\n".join(
            f"• `{scope}` — {scope_descriptions.get(scope, 'Sentry permission.')}"
            for scope in data.scopes
        )

        return SlackRenderable(
            blocks=[
                MarkdownBlock(text="**Allow Seer to make changes?**"),
                MarkdownBlock(text=f"**Requested scopes:**\n{scope_lines}"),
                ActionsBlock(
                    elements=[
                        ButtonElement(
                            text="Reject",
                            value="link_clicked",
                            action_id=encode_action_id(
                                action=SlackAction.SEER_AGENT_WRITE_REJECT.value,
                                organization_id=data.organization_id,
                                project_id=None,
                            ),
                        ),
                        ButtonElement(
                            text="Approve",
                            style="primary",
                            value="link_clicked",
                            action_id=encode_action_id(
                                action=SlackAction.SEER_AGENT_WRITE_APPROVE.value,
                                organization_id=data.organization_id,
                                project_id=None,
                            ),
                        ),
                    ]
                ),
            ],
            text="Seer needs approval to make a change",
        )
