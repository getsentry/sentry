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
    MarkdownBlock,
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
    SeerAgentError,
    SeerAgentResponse,
    SeerAutofixError,
    SeerAutofixTrigger,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint, CodingAgentProviderType

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

HANDOFF_TARGET_LABELS: dict[CodingAgentProviderType, str] = {
    CodingAgentProviderType.CURSOR_BACKGROUND_AGENT: "Cursor",
    CodingAgentProviderType.CLAUDE_CODE_AGENT: "Claude",
    CodingAgentProviderType.GITHUB_COPILOT_AGENT: "Copilot",
}

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


class _SeerSlackRenderer:
    provider_key = NotificationProviderKey.SLACK

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
            value=data.stopping_point,
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_START.value,
                organization_id=data.organization_id,
                project_id=data.project_id,
            ),
        )

    @classmethod
    def _render_handoff_button(
        cls,
        *,
        target: CodingAgentProviderType,
        organization_id: int,
        project_id: int,
    ) -> ButtonElement:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        return ButtonElement(
            text=f"Hand off to {HANDOFF_TARGET_LABELS[target]}",
            style="primary",
            action_id=encode_action_id(
                action=SlackAction.SEER_AUTOFIX_HANDOFF.value,
                organization_id=organization_id,
                project_id=project_id,
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
        if data.handoff_target and data.current_point == AutofixStoppingPoint.ROOT_CAUSE:
            action_elements.append(
                cls._render_handoff_button(
                    target=data.handoff_target,
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                )
            )
        elif data.has_next_trigger:
            action_elements.append(
                cls._render_autofix_button(data=SeerAutofixTrigger.from_update(data))
            )

        config = AUTOFIX_CONFIG[data.current_point]
        blocks: list[Block] = [
            SectionBlock(text=MarkdownTextObject(text=config["heading"]), block_id=first_block_id)
        ]

        if data.summary:
            blocks.append(SectionBlock(text=MarkdownTextObject(text=data.summary)))
        if data.reasoning:
            if data.reasoning_header:
                blocks.append(
                    SectionBlock(text=MarkdownTextObject(text=f"*{data.reasoning_header}*"))
                )
            parts = [RichTextElementParts.Text(text=item) for item in data.reasoning[:MAX_STEPS]]
            sections = [RichTextSectionElement(elements=[part]) for part in parts]
            list_element = RichTextListElement(style="ordered", indent=0, elements=sections)
            blocks.append(RichTextBlock(elements=[list_element]))
        if data.steps:
            if data.steps_header:
                blocks.append(SectionBlock(text=MarkdownTextObject(text=f"*{data.steps_header}*")))
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
    def _render_agent_error(cls, data: SeerAgentError) -> SlackRenderable:
        return SlackRenderable(
            blocks=[
                SectionBlock(text=data.error_title),
                SectionBlock(text=MarkdownTextObject(text=f">{data.error_message}")),
            ],
            text=f"Seer stumbled: {data.error_title}",
        )

    @classmethod
    def _render_agent_response(cls, data: SeerAgentResponse) -> SlackRenderable:
        from sentry import features
        from sentry.models.organization import Organization
        from sentry.seer.endpoints.utils import get_seer_run

        blocks: list[Block] = [MarkdownBlock(text=data.summary)]
        try:
            organization = Organization.objects.get_from_cache(id=data.organization_id)
        except Organization.DoesNotExist:
            organization = None
        if organization and features.has("organizations:seer-run-id-in-slack", organization):
            # Explore Agents conversations use SeerRun.uuid (gen_ai.conversation.id),
            # not Seer's numeric DbRunState id from the Slack payload.
            seer_run = get_seer_run(data.run_id, organization)
            if seer_run is not None:
                conversation_id = str(seer_run.uuid)
                run_url = organization.absolute_url(
                    f"/organizations/{organization.slug}/explore/agents/conversations/{conversation_id}/"
                )
                blocks.append(
                    ContextBlock(
                        elements=[
                            MarkdownTextObject(text=f"Agent Trace: <{run_url}|{conversation_id}>")
                        ]
                    )
                )

        if data.missing_scope_settings_url:
            blocks.extend(cls.render_missing_scope_footer(data.missing_scope_settings_url))

        return SlackRenderable(blocks=blocks, text="Seer Agent has finished")

    @classmethod
    def _render_agent_write_approval(cls, data: SeerAgentResponse) -> SlackRenderable:
        from sentry.integrations.slack.message_builder.routing import encode_action_id
        from sentry.integrations.slack.message_builder.types import SlackAction

        scopes = data.write_approval_scopes or []
        if data.write_approval_status:
            scope_access = ", ".join(cls._get_agent_write_scope_access(scope) for scope in scopes)
            if data.write_approval_status == "approved":
                return SlackRenderable(
                    blocks=[
                        MarkdownBlock(text=f":white_check_mark: Access granted for {scope_access}")
                    ],
                    text="Seer write access approved",
                )
            return SlackRenderable(
                blocks=[MarkdownBlock(text=f":x: Access not granted for {scope_access}")],
                text="Seer write access not approved",
            )
        if not data.write_approval_input_id:
            raise ValueError("Pending agent write approval is missing its input ID")

        scope_descriptions = {
            scope: description
            for scope_set in settings.SENTRY_SCOPE_SETS
            for scope, description in scope_set
        }
        scope_lines = "\n".join(
            f"• `{scope}` — {scope_descriptions.get(scope, 'Sentry permission.')}"
            for scope in scopes
        )
        blocks: list[Block] = [
            MarkdownBlock(text="**Allow Seer to make changes?**"),
            MarkdownBlock(text=f"**Requested scopes:**\n{scope_lines}"),
            # `link_clicked` lets old pods safely no-op these actions during a rolling deploy.
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
        ]
        return SlackRenderable(blocks=blocks, text="Seer needs approval to make a change")

    @staticmethod
    def _get_agent_write_scope_access(scope: str) -> str:
        if scope not in settings.SENTRY_SCOPES:
            return f"the `{scope}` scope"
        action = {
            "read": "reading",
            "write": "reading and writing",
        }.get(scope.rpartition(":")[2], "managing")
        return f"{action} via `{scope}`"

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
        if data.handoff_target is not None:
            label = HANDOFF_TARGET_LABELS[data.handoff_target]
            raw_text = f"{label}'s got this" if has_complete_stage else f"Handing off to {label}..."
        else:
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
    def render_missing_scope_footer(cls, settings_url: str) -> list[Block]:
        """Return a context block warning that optional history scopes are missing."""
        footer_text = (
            f"_I am only able to see the message with the mention. I can't read the whole thread. "
            f"<{settings_url}|Reinstall me> to change that._"
        )
        return [ContextBlock(elements=[MarkdownTextObject(text=footer_text)])]

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


class SeerAutofixTriggerSlackRenderer(_SeerSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAutofixTrigger):
            raise ValueError(
                f"SeerAutofixTriggerSlackRenderer does not support {data.__class__.__name__}"
            )
        return SlackRenderable(
            blocks=[ActionsBlock(elements=[cls._render_autofix_button(data)])],
            text="Seer Autofix Trigger",
        )


class SeerAutofixErrorSlackRenderer(_SeerSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAutofixError):
            raise ValueError(
                f"SeerAutofixErrorSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_autofix_error(data)


class SeerAutofixUpdateSlackRenderer(_SeerSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAutofixUpdate):
            raise ValueError(
                f"SeerAutofixUpdateSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_autofix_update(data)


class SeerAgentErrorSlackRenderer(_SeerSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAgentError):
            raise ValueError(
                f"SeerAgentErrorSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_agent_error(data)


class SeerAgentResponseSlackRenderer(_SeerSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAgentResponse):
            raise ValueError(
                f"SeerAgentResponseSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_agent_response(data)


class SeerAgentWriteApprovalSlackRenderer(
    _SeerSlackRenderer, NotificationRenderer[SlackRenderable]
):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAgentResponse) or not data.write_approval_scopes:
            raise ValueError(
                f"SeerAgentWriteApprovalSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_agent_write_approval(data)


_SEER_SLACK_RENDERERS: dict[NotificationSource, type[NotificationRenderer[SlackRenderable]]] = {
    NotificationSource.SEER_AUTOFIX_TRIGGER: SeerAutofixTriggerSlackRenderer,
    NotificationSource.SEER_AUTOFIX_ERROR: SeerAutofixErrorSlackRenderer,
    NotificationSource.SEER_AUTOFIX_UPDATE: SeerAutofixUpdateSlackRenderer,
    NotificationSource.SEER_AGENT_ERROR: SeerAgentErrorSlackRenderer,
    NotificationSource.SEER_AGENT_RESPONSE: SeerAgentResponseSlackRenderer,
}


def get_seer_slack_renderer(
    data: NotificationData,
) -> type[NotificationRenderer[SlackRenderable]]:
    if isinstance(data, SeerAgentResponse) and data.write_approval_scopes:
        return SeerAgentWriteApprovalSlackRenderer
    try:
        return _SEER_SLACK_RENDERERS[data.source]
    except KeyError:
        raise ValueError(f"No Seer Slack renderer registered for {data.source}") from None
