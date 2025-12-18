from slack_sdk.models.blocks import (
    ActionsBlock,
    ButtonElement,
    ContextBlock,
    InputBlock,
    MarkdownTextObject,
    PlainTextInputElement,
    PlainTextObject,
    SectionBlock,
)

from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import (
    SeerAutofixError,
    SeerAutofixTrigger,
    SeerContextInput,
    SeerContextInputComplete,
)
from sentry.notifications.platform.types import NotificationData, NotificationRenderedTemplate


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
        elif isinstance(data, SeerContextInput):
            return cls.render_context_input(data)
        elif isinstance(data, SeerContextInputComplete):
            return cls.render_context_input_complete(data)
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")

    @classmethod
    def render_autofix_button(cls, data: SeerAutofixTrigger) -> ButtonElement:
        from sentry.integrations.slack.message_builder.types import SlackAction

        return ButtonElement(
            text=data.label,
            style="primary",
            value=SlackAction.SEER_AUTOFIX_START.value,
            action_id=SlackAction.SEER_AUTOFIX_START.value,
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
    def render_context_input(cls, data: SeerContextInput) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.types import SlackAction

        return SlackRenderable(
            blocks=[
                InputBlock(
                    dispatch_action=True,
                    label=PlainTextObject(text=data.label),
                    element=PlainTextInputElement(
                        placeholder=PlainTextObject(text=data.placeholder),
                        action_id=SlackAction.SEER_CONTEXT_INPUT.value,
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
