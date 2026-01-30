from typing import TypedDict

import orjson
from slack_sdk.models.blocks import (
    ActionsBlock,
    Block,
    ButtonElement,
    ContextBlock,
    InteractiveElement,
    LinkButtonElement,
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


class AutofixStageConfig(TypedDict):
    heading: str
    forward_text: str | None
    past_steps: list[str]


AUTOFIX_CONFIG: dict[AutofixStoppingPoint, AutofixStageConfig] = {
    AutofixStoppingPoint.ROOT_CAUSE: AutofixStageConfig(
        heading=":mag:  *Root Cause Analysis*",
        forward_text="_Seer is working on the solution..._",
        past_steps=[":hourglass: analyzing the root cause..."],
    ),
    AutofixStoppingPoint.SOLUTION: AutofixStageConfig(
        heading=":test_tube:  *Proposed Solution*",
        forward_text="_Seer is writing the code..._",
        past_steps=[":white_check_mark: root cause analyzed", ":hourglass: planning solution..."],
    ),
    AutofixStoppingPoint.CODE_CHANGES: AutofixStageConfig(
        heading=":pencil2:  *Code Change Suggestions*",
        forward_text="_Seer is drafting a pull request..._",
        past_steps=[
            ":white_check_mark: root cause analyzed",
            ":white_check_mark: solution planned",
            ":hourglass: generating code changes...",
        ],
    ),
    AutofixStoppingPoint.OPEN_PR: AutofixStageConfig(
        heading=":link:  *Pull Request*",
        forward_text=None,
        past_steps=[
            ":white_check_mark: root cause analyzed",
            ":white_check_mark: solution planned",
            ":white_check_mark: code changes generated",
            ":hourglass: drafting the pull request...",
        ],
    ),
}


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
        autofix_mrkdwn_parts = AUTOFIX_CONFIG[data.stopping_point].get("past_steps", [])
        return SlackRenderable(
            blocks=[
                SectionBlock(text=MarkdownTextObject(text="*Seer's on it*")),
                SectionBlock(text=MarkdownTextObject(text="\n\n".join(autofix_mrkdwn_parts))),
                ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
            ],
            text="Seer Autofix Success",
        )

    @classmethod
    def render_autofix_update(cls, data: SeerAutofixUpdate) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        first_block_id = cls.create_first_block_id(group_id=data.group_id, run_id=data.run_id)
        link_button = cls._render_link_button(data=data)
        action_elements: list[InteractiveElement] = []
        if not data.has_progressed and data.current_point != AutofixStoppingPoint.OPEN_PR:
            action_elements.append(link_button)
            action_elements.append(
                cls.render_autofix_button(data=SeerAutofixTrigger.from_update(data))
            )

        config = AUTOFIX_CONFIG[data.current_point]
        blocks: list[Block] = [
            SectionBlock(text=MarkdownTextObject(text=config["heading"]), block_id=first_block_id)
        ]

        if data.summary:
            blocks.append(SectionBlock(text=MarkdownTextObject(text=data.summary)))
        if data.steps:
            parts = [RichTextElementParts.Text(text=step) for step in data.steps]
            sections = [RichTextSectionElement(elements=[part]) for part in parts]
            list_element = RichTextListElement(style="ordered", indent=0, elements=sections)
            blocks.append(RichTextBlock(elements=[list_element]))
        if data.changes:
            for change in data.changes:
                change_mrkdwn = f"_In {change['repo_name']}_:\n*{change['title']}*\n{change['description']}\n```\n{change['diff']}```"
                blocks.append(SectionBlock(text=MarkdownTextObject(text=change_mrkdwn)))
        if data.pull_requests:
            action_id = encode_action_id(
                action=SlackAction.SEER_AUTOFIX_VIEW_PR.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            )
            for pr in data.pull_requests:
                action_elements.append(
                    LinkButtonElement(
                        text=f"View PR (#{pr['pr_number']})",
                        style="primary",
                        url=pr["pr_url"],
                        action_id=f"{action_id}::{pr['pr_number']}",
                    )
                )

        if action_elements:
            blocks.append(ActionsBlock(elements=action_elements))

        if data.has_progressed and data.current_point != AutofixStoppingPoint.OPEN_PR:
            blocks.extend(cls.render_footer_blocks(data=data))
        return SlackRenderable(blocks=blocks, text="Seer Autofix Update")

    @classmethod
    def _render_link_button(cls, data: SeerAutofixUpdate) -> LinkButtonElement:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        return LinkButtonElement(
            text="View in Sentry",
            url=data.group_link,
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_VIEW_IN_SENTRY.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            ),
        )

    @classmethod
    def render_footer_blocks(
        cls, data: SeerAutofixUpdate, extra_text: str | None = None
    ) -> list[Block]:
        markdown_text = (
            f"_{data.working_text}_\n_{extra_text}_" if extra_text else f"_{data.working_text}_"
        )
        return [
            SectionBlock(
                text=MarkdownTextObject(text=markdown_text),
                accessory=cls._render_link_button(data),
            ),
            ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
        ]
