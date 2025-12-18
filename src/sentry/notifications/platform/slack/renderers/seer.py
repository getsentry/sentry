import orjson
from slack_sdk.models.blocks import (
    ActionsBlock,
    ButtonElement,
    ContextBlock,
    MarkdownTextObject,
    PlainTextObject,
    RichTextBlock,
    RichTextElementParts,
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
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")

    @classmethod
    def create_first_block_id(cls, group_id: int, run_id: int | None) -> str:
        # The action handler will fail if the first block's block_id is not JSON-encoded with
        # group data, so we have to modify that block when emitting actions.
        return orjson.dumps({"issue": group_id, "run_id": run_id}).decode()

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
            autofix_mrkdwn_parts.append(":hourglass: Analyzing Root Cause...")
        elif data.stopping_point == AutofixStoppingPoint.SOLUTION:
            autofix_mrkdwn_parts.append(":white_check_mark: Root Cause Analyzed")
            autofix_mrkdwn_parts.append(":hourglass: Planning Solution...")
        elif data.stopping_point == AutofixStoppingPoint.CODE_CHANGES:
            autofix_mrkdwn_parts.append(":white_check_mark: Root Cause Analyzed")
            autofix_mrkdwn_parts.append(":white_check_mark: Solution Planned")
            autofix_mrkdwn_parts.append(":hourglass: Generating Code Changes...")
        elif data.stopping_point == AutofixStoppingPoint.OPEN_PR:
            autofix_mrkdwn_parts.append(":white_check_mark: Start Root Cause Analysis")
            autofix_mrkdwn_parts.append(":white_check_mark: Plan a Solution")
            autofix_mrkdwn_parts.append(":white_check_mark: Code Changes Generated")
            autofix_mrkdwn_parts.append(":hourglass: Draft a Pull Request")

        autofix_mrkdwn = "\n\n".join(autofix_mrkdwn_parts)

        return SlackRenderable(
            blocks=[
                SectionBlock(text=MarkdownTextObject(text=autofix_mrkdwn)),
                ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
            ],
            text="Seer Autofix Success",
        )

    @classmethod
    def render_autofix_update(cls, data: SeerAutofixUpdate) -> SlackRenderable:
        first_block_id = cls.create_first_block_id(group_id=data.group_id, run_id=data.run_id)
        extra_blocks = []
        if data.current_point == AutofixStoppingPoint.ROOT_CAUSE:
            current_stage_mrkdwn = ":mag: *Root Cause Analysis*"
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                    group_id=data.group_id,
                    run_id=data.run_id,
                    stopping_point=AutofixStoppingPoint.SOLUTION,
                )
            )
        elif data.current_point == AutofixStoppingPoint.SOLUTION:
            current_stage_mrkdwn = ":test_tube: *Proposed Solution*"
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                    group_id=data.group_id,
                    run_id=data.run_id,
                    stopping_point=AutofixStoppingPoint.CODE_CHANGES,
                )
            )
        elif data.current_point == AutofixStoppingPoint.CODE_CHANGES:
            current_stage_mrkdwn = ":computer: *Code Change Suggestions*"
            for change in data.changes:
                extra_blocks.extend(
                    [
                        ContextBlock(
                            elements=[
                                MarkdownTextObject(
                                    text=f":file_folder: *Repository:* `{change["repo_name"]}`"
                                )
                            ]
                        ),
                        SectionBlock(
                            text=MarkdownTextObject(text=f"*Pull Request Title*\n{change['title']}")
                        ),
                        SectionBlock(
                            text=MarkdownTextObject(
                                text=f"*Pull Request Description*\n{change['description']}"
                            )
                        ),
                        SectionBlock(text=MarkdownTextObject(text="*Code Changes*")),
                        SectionBlock(
                            text=MarkdownTextObject(text=f"```diff\n{change['diff']}\n```")
                        ),
                    ]
                )
            next_stage_button = cls.render_autofix_button(
                data=SeerAutofixTrigger(
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                    group_id=data.group_id,
                    run_id=data.run_id,
                    stopping_point=AutofixStoppingPoint.OPEN_PR,
                )
            )
        elif data.current_point == AutofixStoppingPoint.OPEN_PR:
            current_stage_mrkdwn = ":pencil2: *Pull Request*"
            next_stage_button = ButtonElement(
                text="Draft Request", style="primary", url=data.group_link
            )

        return SlackRenderable(
            blocks=[
                SectionBlock(
                    text=MarkdownTextObject(text=current_stage_mrkdwn), block_id=first_block_id
                ),
                SectionBlock(text=MarkdownTextObject(text=data.summary)),
                *extra_blocks,
                RichTextBlock(
                    elements=[
                        RichTextListElement(
                            style="ordered",
                            indent=0,
                            elements=[
                                RichTextSectionElement(
                                    elements=[RichTextElementParts.Text(text=step)]
                                )
                                for step in data.steps
                            ],
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
