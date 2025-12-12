from slack_sdk.models.blocks import (
    ActionsBlock,
    ButtonElement,
    InputBlock,
    InputInteractiveElement,
    MarkdownTextObject,
    SectionBlock,
)

from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import (
    SeerContextInput,
    SeerContextInputComplete,
    SeerPartialAutofixTriggers,
)
from sentry.notifications.platform.types import NotificationData, NotificationRenderedTemplate


class SeerSlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if isinstance(data, SeerPartialAutofixTriggers):
            autofix_button = cls.render_autofix_button(data)
            return SlackRenderable(
                blocks=[ActionsBlock(elements=[autofix_button])],
                text="Seer Partial Autofix Triggers",
            )
        elif isinstance(data, SeerContextInput):
            return cls.render_context_input(data)
        elif isinstance(data, SeerContextInputComplete):
            return cls.render_context_input_complete(data)
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")

    @classmethod
    def render_autofix_button(cls, data: SeerPartialAutofixTriggers) -> ButtonElement:
        from sentry.integrations.slack.message_builder.types import SlackAction

        return ButtonElement(
            text=data.label,
            style="primary",
            value=SlackAction.SEER_AUTOFIX_START.value,
            action_id=SlackAction.SEER_AUTOFIX_START.value,
        )

    @classmethod
    def render_context_input(cls, data: SeerContextInput) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.types import SlackAction

        return SlackRenderable(
            blocks=[
                InputBlock(
                    dispatch_action=True,
                    label=data.label,
                    element=InputInteractiveElement(
                        placeholder=data.placeholder, action_id=SlackAction.SEER_CONTEXT_INPUT.value
                    ),
                )
            ],
            text="Seer Context Input",
        )

    @classmethod
    def render_context_input_complete(cls, data: SeerContextInputComplete) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                SectionBlock(text=MarkdownTextObject(text="*Seer says thanks.*")),
                SectionBlock(text=MarkdownTextObject(text=f"> {data.provided_context}")),
            ],
            text="Seer Context Input Complete",
        )
