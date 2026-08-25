from __future__ import annotations

from django.conf import settings
from slack_sdk.models.blocks import (
    ActionsBlock,
    Block,
    ButtonElement,
    ContextBlock,
    MarkdownBlock,
    MarkdownTextObject,
    SectionBlock,
)

from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import SeerAgentError, SeerAgentResponse
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
)


class _SeerAgentSlackRenderer:
    provider_key = NotificationProviderKey.SLACK

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
    def render_missing_scope_footer(cls, settings_url: str) -> list[Block]:
        """Return a context block warning that optional history scopes are missing."""
        footer_text = (
            f"_I am only able to see the message with the mention. I can't read the whole thread. "
            f"<{settings_url}|Reinstall me> to change that._"
        )
        return [ContextBlock(elements=[MarkdownTextObject(text=footer_text)])]


class SeerAgentErrorSlackRenderer(_SeerAgentSlackRenderer, NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if not isinstance(data, SeerAgentError):
            raise ValueError(
                f"SeerAgentErrorSlackRenderer does not support {data.__class__.__name__}"
            )
        return cls._render_agent_error(data)


class SeerAgentResponseSlackRenderer(
    _SeerAgentSlackRenderer, NotificationRenderer[SlackRenderable]
):
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
    _SeerAgentSlackRenderer, NotificationRenderer[SlackRenderable]
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
