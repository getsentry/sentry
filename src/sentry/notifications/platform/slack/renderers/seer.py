from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

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
    SeerAutofixTrigger,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import NotificationData, NotificationRenderedTemplate
from sentry.seer.autofix.utils import AutofixStoppingPoint

if TYPE_CHECKING:
    from sentry.models.group import Group


class AutofixStageConfig(TypedDict):
    heading: str
    label: str
    working_text: str | None


MAX_STEPS = 10
MAX_CHANGES = 5
MAX_PRS = 3

AUTOFIX_CONFIG: dict[AutofixStoppingPoint, AutofixStageConfig] = {
    AutofixStoppingPoint.ROOT_CAUSE: AutofixStageConfig(
        heading=":mag:  *Root Cause Analysis*",
        label="Fix with Seer",
        working_text="Seer is analyzing the root cause...",
    ),
    AutofixStoppingPoint.SOLUTION: AutofixStageConfig(
        heading=":test_tube:  *Proposed Solution*",
        label="Plan a Solution",
        working_text="Seer is working on the solution...",
    ),
    AutofixStoppingPoint.CODE_CHANGES: AutofixStageConfig(
        heading=":pencil2:  *Code Change Suggestions*",
        label="Write Code Changes",
        working_text="Seer is writing the code...",
    ),
    AutofixStoppingPoint.OPEN_PR: AutofixStageConfig(
        heading=":link:  *Pull Request*",
        label="Draft a PR",
        working_text="Seer is drafting a pull request...",
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
            text=f"Error while Seer was attempting a fix: {data.error_title}",
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
        action_elements: list[InteractiveElement] = []
        if not data.has_progressed:
            action_elements.append(link_button)

        if not data.has_progressed and data.has_next_trigger:
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
                change_mrkdwn = f"_In {change['repo_name']}_:\n*{change['title']}*\n{change['description']}\n```\n{change['diff']}```"
                blocks.append(SectionBlock(text=MarkdownTextObject(text=change_mrkdwn)))
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

        if data.has_progressed and data.current_point != AutofixStoppingPoint.OPEN_PR:
            blocks.extend(cls.render_footer_blocks(data=data))
        return SlackRenderable(blocks=blocks, text="Seer has an update on fixing the issue!")

    @classmethod
    def _render_link_button(
        cls, *, organization_id: int, project_id: int, group_link: str, text: str = "View in Sentry"
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
        stage_completed: bool = True,
    ) -> list[Block]:
        rendered_point = data.next_point if stage_completed else data.current_point
        if not rendered_point:
            return []
        config = AUTOFIX_CONFIG[rendered_point]
        markdown_text = (
            f"_{config['working_text']}_\n_{extra_text}_"
            if extra_text
            else f"_{config['working_text']}_"
        )
        return [
            SectionBlock(
                text=MarkdownTextObject(text=markdown_text),
                accessory=cls._render_link_button(
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                    group_link=data.group_link,
                ),
            ),
            ContextBlock(elements=[PlainTextObject(text=f"Run ID: {data.run_id}")]),
        ]

    @classmethod
    def render_alert_autofix_element(cls, group: Group) -> InteractiveElement:
        """
        Will either render an autofix button, or a link to the autofix panel in Sentry.
        If the issue has automations, a run should be scheduled/in-progress.
            - So, it'll render the link (the updates will be threaded later)
        If the issue doesn't have automations, a run will only be triggered manually.
            - So, we can render the autofix button for RCA.
        """
        from sentry.seer.autofix.issue_summary import is_group_triggering_automation
        from sentry.seer.entrypoints.integrations.slack import SlackEntrypoint

        try:
            is_triggering = is_group_triggering_automation(group)
        except Exception:
            is_triggering = False

        if is_triggering:
            return cls._render_link_button(
                organization_id=group.project.organization_id,
                project_id=group.project_id,
                group_link=SlackEntrypoint.get_group_link(group),
                text="Watch Seer Work :sparkles:",
            )

        return cls._render_autofix_button(
            data=SeerAutofixTrigger(
                group_id=group.id,
                project_id=group.project_id,
                organization_id=group.project.organization_id,
                stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
            )
        )
