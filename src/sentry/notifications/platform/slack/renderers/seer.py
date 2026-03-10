from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

import orjson
from django.conf import settings
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
    SeerAutofixTrigger,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationRenderedTemplate,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint

if TYPE_CHECKING:
    from sentry.models.group import Group


class AutofixStageConfig(TypedDict):
    heading: str
    label: str
    working_text: str
    completed_text: str


MAX_STEPS = 10
MAX_CHANGES = 5
MAX_PRS = 3

AUTOFIX_CONFIG: dict[AutofixStoppingPoint, AutofixStageConfig] = {
    AutofixStoppingPoint.ROOT_CAUSE: AutofixStageConfig(
        heading=":mag:  *Root Cause Analysis*",
        label="Fix with Seer",
        working_text="Seer is peering into the void...",
        completed_text="Seer's eye has seen the root cause",
    ),
    AutofixStoppingPoint.SOLUTION: AutofixStageConfig(
        heading=":test_tube:  *Proposed Solution*",
        label="Plan a Solution",
        working_text="Seer is conjuring a solution...",
        completed_text="Seer has materialized a plan",
    ),
    AutofixStoppingPoint.CODE_CHANGES: AutofixStageConfig(
        heading=":pencil2:  *Code Change Suggestions*",
        label="Write Code Changes",
        working_text="Seer's many hands are typing...",
        completed_text="Seer has synthesized the changes",
    ),
    AutofixStoppingPoint.OPEN_PR: AutofixStageConfig(
        heading=":link:  *Pull Request*",
        label="Draft a PR",
        working_text="Seer is manifesting a PR...",
        completed_text="Seer has summoned your pull request",
    ),
}


class SeerSlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if isinstance(data, SeerAutofixTrigger):
            autofix_button = cls._render_autofix_button(data)
            return SlackRenderable(
                blocks=[ActionsBlock(elements=[autofix_button])],
                text="Seer Autofix Trigger",
            )
        elif isinstance(data, SeerAutofixError):
            return cls._render_autofix_error(data)
        elif isinstance(data, SeerAutofixUpdate):
            return cls._render_autofix_update(data)
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")

    @classmethod
    def create_first_block_id(cls, group_id: int, run_id: int | None) -> str:
        # The action handler will fail if the first block's block_id is not JSON-encoded with
        # group data, so we have to modify that block when emitting actions.
        return orjson.dumps({"issue": group_id, "run_id": run_id}).decode()

    @classmethod
    def _render_autofix_button(cls, data: SeerAutofixTrigger) -> ButtonElement:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        return ButtonElement(
            text=AUTOFIX_CONFIG[data.stopping_point]["label"],
            style="primary",
            value=data.stopping_point.value,
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_START.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            ),
        )

    @classmethod
    def _render_autofix_error(cls, data: SeerAutofixError) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                SectionBlock(text=data.error_title),
                SectionBlock(text=MarkdownTextObject(text=f">{data.error_message}")),
            ],
            text=f"Seer stumbled: {data.error_title}",
        )

    @classmethod
    def _render_autofix_update(cls, data: SeerAutofixUpdate) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        first_block_id = cls.create_first_block_id(group_id=data.group_id, run_id=data.run_id)
        link_button = cls._render_link_button(
            organization_id=data.organization_id,
            project_id=data.project_id,
            group_link=data.group_link,
        )
        action_elements: list[InteractiveElement] = [link_button]
        if data.has_next_trigger:
            action_elements.append(
                cls._render_autofix_button(data=SeerAutofixTrigger.from_update(data))
            )

        config = AUTOFIX_CONFIG[data.current_point]
        blocks: list[Block] = [
            SectionBlock(text=MarkdownTextObject(text=config["heading"]), block_id=first_block_id)
        ]

        if data.summary:
            blocks.append(SectionBlock(text=MarkdownTextObject(text=data.summary)))
        if data.steps:
            parts = [RichTextElementParts.Text(text=step) for step in data.steps[:MAX_STEPS]]
            sections = [RichTextSectionElement(elements=[part]) for part in parts]
            list_element = RichTextListElement(style="ordered", indent=0, elements=sections)
            blocks.append(RichTextBlock(elements=[list_element]))
        if data.changes:
            for change in data.changes[:MAX_CHANGES]:
                change_mrkdwn = [f"_In {change['repo_name']}_:"]
                if change.get("title"):
                    change_mrkdwn.append(f"*{change['title']}*")

                if change.get("description"):
                    change_mrkdwn.append(f"{change['description']}")
                if change.get("diff"):
                    change_mrkdwn.append(f"```{change['diff']}```")
                blocks.append(SectionBlock(text=MarkdownTextObject(text="\n".join(change_mrkdwn))))
        if data.pull_requests:
            action_id = encode_action_id(
                action=SlackAction.SEER_AUTOFIX_VIEW_PR.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            )
            for pr in data.pull_requests[:MAX_PRS]:
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

        return SlackRenderable(blocks=blocks, text="Seer has emerged with news from its voyage")

    @classmethod
    def _render_link_button(
        cls,
        *,
        organization_id: int,
        project_id: int,
        group_link: str,
        text: str = "View in Sentry",
    ) -> LinkButtonElement:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        return LinkButtonElement(
            text=text,
            url=group_link,
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_VIEW_IN_SENTRY.value,
                organization_id=organization_id,
                project_id=project_id,
            ),
        )

    @classmethod
    def render_footer_blocks(
        cls,
        data: SeerAutofixUpdate,
        extra_text: str | None = None,
        has_complete_stage: bool = True,
    ) -> list[Block]:
        config = AUTOFIX_CONFIG[data.current_point]
        raw_text = config["completed_text"] if has_complete_stage else config["working_text"]
        markdown_text = f"_{raw_text}_"

        if extra_text:
            markdown_text += f"\n_{extra_text}_"

        blocks: list[Block] = [
            SectionBlock(
                text=MarkdownTextObject(text=markdown_text),
                accessory=cls._render_link_button(
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                    group_link=data.group_link,
                ),
            ),
        ]

        if settings.DEBUG:
            blocks.append(ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]))

        return blocks

    @classmethod
    def render_autofix_button(cls, group: Group) -> InteractiveElement:
        """
        Returns an autofix button for manual RCA trigger.
        """

        return cls._render_autofix_button(
            data=SeerAutofixTrigger(
                group_id=group.id,
                project_id=group.project_id,
                organization_id=group.project.organization_id,
                stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
            )
        )
