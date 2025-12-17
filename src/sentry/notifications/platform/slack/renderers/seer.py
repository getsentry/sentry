from slack_sdk.models.blocks import (
    ActionsBlock,
    ButtonElement,
    ContextBlock,
    InputBlock,
    MarkdownTextObject,
    PlainTextInputElement,
    PlainTextObject,
    RichTextBlock,
    RichTextListElement,
    RichTextSectionElement,
    SectionBlock,
)

from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import (
    SeerAutofixError,
    SeerAutofixSuccess,
    SeerAutofixTrigger,
    SeerAutofixUpdate,
    SeerContextInput,
    SeerContextInputComplete,
)
from sentry.notifications.platform.types import NotificationData, NotificationRenderedTemplate
from sentry.seer.autofix.utils import AutofixStoppingPoint


class SeerSlackRenderer(NotificationRenderer[SlackRenderable]):

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if isinstance(data, SeerAutofixTrigger):
            autofix_button = cls.render_autofix_button(data)
            return SlackRenderable(
                blocks=[ActionsBlock(elements=[autofix_button])],
                text="Seer Autofix Trigger",
            )
        elif isinstance(data, SeerAutofixError):
            return cls.render_autofix_error(data)
        elif isinstance(data, SeerAutofixSuccess):
            return cls.render_autofix_success(data)
        elif isinstance(data, SeerAutofixUpdate):
            return cls.render_autofix_update(data)
        elif isinstance(data, SeerContextInput):
            return cls.render_context_input(data)
        elif isinstance(data, SeerContextInputComplete):
            return cls.render_context_input_complete(data)
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")

    @classmethod
    def render_autofix_button(cls, data: SeerAutofixTrigger) -> ButtonElement:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        return ButtonElement(
            text=data.label,
            style="primary",
            value=data.stopping_point.value,
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_START.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            ),
        )

    @classmethod
    def render_autofix_error(cls, data: SeerAutofixError) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                SectionBlock(text=data.error_title),
                SectionBlock(text=MarkdownTextObject(text=f">{data.error_message}")),
            ],
            text="Seer Autofix Error",
        )

    @classmethod
    def render_autofix_success(cls, data: SeerAutofixSuccess) -> SlackRenderable:
        autofix_mrkdwn_parts: list[str] = []
        if data.stopping_point == AutofixStoppingPoint.ROOT_CAUSE:
            autofix_mrkdwn_parts.append(":hourglass: Start Root Cause Analysis")
        elif data.stopping_point == AutofixStoppingPoint.SOLUTION:
            autofix_mrkdwn_parts.append(":white_check_mark: Start Root Cause Analysis")
            autofix_mrkdwn_parts.append(":hourglass: Plan a Solution")
        elif data.stopping_point == AutofixStoppingPoint.CODE_CHANGES:
            autofix_mrkdwn_parts.append(":white_check_mark: Start Root Cause Analysis")
            autofix_mrkdwn_parts.append(":white_check_mark: Plan a Solution")
            autofix_mrkdwn_parts.append(":hourglass: Write Code Changes")
        elif data.stopping_point == AutofixStoppingPoint.OPEN_PR:
            autofix_mrkdwn_parts.append(":white_check_mark: Start Root Cause Analysis")
            autofix_mrkdwn_parts.append(":white_check_mark: Plan a Solution")
            autofix_mrkdwn_parts.append(":white_check_mark: Write Code Changes")
            autofix_mrkdwn_parts.append(":hourglass: Draft a Pull Request")

        autofix_mrkdwn = "\n\n".join(autofix_mrkdwn_parts)

        return SlackRenderable(
            blocks=[
                SectionBlock(text=MarkdownTextObject(text="*Seer is working on it...*")),
                SectionBlock(text=MarkdownTextObject(text=autofix_mrkdwn)),
                ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
            ],
            text="Seer Autofix Success",
        )

    def render_autofix_update(cls, data: SeerAutofixUpdate) -> SlackRenderable:
        if data.current_point == AutofixStoppingPoint.ROOT_CAUSE:
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=None,
                    stopping_point=AutofixStoppingPoint.SOLUTION,
                )
            )
        elif data.current_point == AutofixStoppingPoint.SOLUTION:
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=None,
                    stopping_point=AutofixStoppingPoint.CODE_CHANGES,
                )
            )
        elif data.current_point == AutofixStoppingPoint.CODE_CHANGES:
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=None,
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                )
            )
        elif data.current_point == AutofixStoppingPoint.OPEN_PR:
            next_stage_button = ButtonElement(
                text="View Pull Request", style="primary", url=data.group_link
            )

        return SlackRenderable(
            blocks=[
                RichTextBlock(
                    elements=[
                        RichTextSectionElement(elements=[{"type": "text", "text": data.summary}]),
                        RichTextListElement(
                            elements=[{"type": "text", "text": step} for step in data.steps]
                        ),
                    ]
                ),
                ActionsBlock(
                    elements=[
                        ButtonElement(text="View in Sentry", url=data.group_link),
                        next_stage_button,
                    ]
                ),
                ContextBlock(elements=[MarkdownTextObject(text=f"Run ID: {data.run_id}")]),
            ],
            text="Seer Autofix Update",
        )

    @classmethod
    def render_context_input(cls, data: SeerContextInput) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.types import SlackAction
        from sentry.seer.entrypoints.integrations.slack import encode_context_block_id

        return SlackRenderable(
            blocks=[
                InputBlock(
                    dispatch_action=True,
                    label=PlainTextObject(text=data.label),
                    element=PlainTextInputElement(
                        placeholder=PlainTextObject(text=data.placeholder),
                        action_id=SlackAction.SEER_CONTEXT_INPUT.value,
                    ),
                    block_id=encode_context_block_id(
                        run_id=data.run_id,
                        organization_id=data.organization_id,
                    ),
                ),
                ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
            ],
            text="Seer Context Input",
        )

    @classmethod
    def render_context_input_complete(cls, data: SeerContextInputComplete) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                SectionBlock(text=MarkdownTextObject(text="*Seer says thanks.*")),
                SectionBlock(text=MarkdownTextObject(text=f">{data.provided_context}")),
            ],
            text="Seer Context Input Complete",
        )
