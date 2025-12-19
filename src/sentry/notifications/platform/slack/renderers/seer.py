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
            autofix_mrkdwn_parts.append(":hourglass: analyzing the root cause...")
        elif data.stopping_point == AutofixStoppingPoint.SOLUTION:
            autofix_mrkdwn_parts.append(":white_check_mark: root cause analyzed")
            autofix_mrkdwn_parts.append(":hourglass: planning solution...")
        elif data.stopping_point == AutofixStoppingPoint.CODE_CHANGES:
            autofix_mrkdwn_parts.append(":white_check_mark: root cause analyzed")
            autofix_mrkdwn_parts.append(":white_check_mark: solution planned")
            autofix_mrkdwn_parts.append(":hourglass: generating code changes...")
        elif data.stopping_point == AutofixStoppingPoint.OPEN_PR:
            autofix_mrkdwn_parts.append(":white_check_mark: root cause analyzed")
            autofix_mrkdwn_parts.append(":white_check_mark: solution planned")
            autofix_mrkdwn_parts.append(":white_check_mark: code changes generated")
            autofix_mrkdwn_parts.append(":hourglass: drafting the pull request...")

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
        content_blocks: list[Block] = []
        action_elements: list[InteractiveElement] = [
            LinkButtonElement(
                text="View in Sentry",
                url=data.group_link,
                action_id=encode_action_id(
                    action=SlackAction.SEER_AUTOFIX_VIEW_IN_SENTRY.value,
                    organization_id=data.organization_id,
                    project_id=data.project_id,
                ),
            ),
        ]
        if data.current_point == AutofixStoppingPoint.ROOT_CAUSE:
            current_stage_mrkdwn = ":mag:  *Root Cause Analysis*"
            action_elements.append(
                cls.render_autofix_button(
                    data=SeerAutofixTrigger(
                        organization_id=data.organization_id,
                        project_id=data.project_id,
                        group_id=data.group_id,
                        run_id=data.run_id,
                        stopping_point=AutofixStoppingPoint.SOLUTION,
                    )
                )
            )
        elif data.current_point == AutofixStoppingPoint.SOLUTION:
            current_stage_mrkdwn = ":test_tube:  *Proposed Solution*"
            action_elements.append(
                cls.render_autofix_button(
                    data=SeerAutofixTrigger(
                        organization_id=data.organization_id,
                        project_id=data.project_id,
                        group_id=data.group_id,
                        run_id=data.run_id,
                        stopping_point=AutofixStoppingPoint.CODE_CHANGES,
                    )
                )
            )
        elif data.current_point == AutofixStoppingPoint.CODE_CHANGES:
            current_stage_mrkdwn = ":pencil2:  *Code Change Suggestions*"
            for change in data.changes:
                content_blocks.append(
                    SectionBlock(
                        text=MarkdownTextObject(
                            text=f"_In {change['repo_name']}_:\n*{change['title']}*\n{change['description']}\n```\n{change['diff']}```"
                        )
                    )
                )
            action_elements.append(
                cls.render_autofix_button(
                    data=SeerAutofixTrigger(
                        organization_id=data.organization_id,
                        project_id=data.project_id,
                        group_id=data.group_id,
                        run_id=data.run_id,
                        stopping_point=AutofixStoppingPoint.OPEN_PR,
                    )
                )
            )
        elif data.current_point == AutofixStoppingPoint.OPEN_PR:
            current_stage_mrkdwn = ":link:  *Pull Request*"
            for pull_request in data.pull_requests:
                action_elements.append(
                    LinkButtonElement(
                        text=f"View PR (#{pull_request['pr_number']})",
                        style="primary",
                        url=pull_request["pr_url"],
                        action_id=encode_action_id(
                            action=SlackAction.SEER_AUTOFIX_VIEW_PR.value,
                            organization_id=data.organization_id,
                            project_id=data.project_id,
                        ),
                    )
                )

        blocks: list[Block] = [
            SectionBlock(
                text=MarkdownTextObject(text=current_stage_mrkdwn), block_id=first_block_id
            )
        ]

        if data.summary:
            blocks.append(SectionBlock(text=MarkdownTextObject(text=data.summary)))
        if data.changes:
            blocks.extend(content_blocks)
        if data.steps:
            blocks.append(
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
                        )
                    ]
                )
            )
        blocks.append(ActionsBlock(elements=action_elements))
        blocks.append(ContextBlock(elements=[MarkdownTextObject(text=f"Run ID: {data.run_id}")]))
        return SlackRenderable(blocks=blocks, text="Seer Autofix Update")
