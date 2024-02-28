from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.message_builder import build_attachment_title, get_title_link
from sentry.integrations.slack.message_builder import SlackAttachment, SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.tasks.summaries.utils import COMPARISON_PERIOD
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class SlackDailySummaryMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def linkify_error_title(self, group):
        link = get_title_link(group, None, False, False, self, ExternalProviders.SLACK)
        title = build_attachment_title(group)
        return f"<{link}|*{escape_slack_text(title)}*>"

    def build(self) -> SlackAttachment | SlackBlock:
        blocks = []
        blocks.append(
            self.get_markdown_block(
                "*Daily Summary for Your Projects*\nYour comprehensive overview for today - key issues, performance insights, and more.",
                ":bell:",
            )
        )
        blocks.append(self.get_divider())

        for project_id, context in self.context.items():
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                continue

            project_text = f"*{project.slug}*: Here is some text about this section!"
            blocks.append(self.get_markdown_block(project_text))

            # Add release info if we have it
            if context.new_in_release:
                for release_id, errors in context.new_in_release.items():
                    try:
                        release = Release.objects.get(id=release_id)
                    except Release.DoesNotExist:
                        continue
                    release_text = f":rocket: *{release.version}*:\n"
                    for error in errors[0:3]:
                        linked_title = self.linkify_error_title(error)
                        release_text += f"• :new: {linked_title}"
                blocks.append(self.get_markdown_block(release_text))

            # Calculate today's event count percentage against 14 day avg
            event_count_text = f"*Today’s Event Count*: {context.total_today}\n"
            # percentage_diff = context.total_today / context.comparison_period_avg
            percentage_diff = 100 / 2
            if context.total_today > context.comparison_period_avg:
                event_count_text += (
                    f"\n:warning: {percentage_diff:.0%} higher than last {COMPARISON_PERIOD}d avg"
                )
            else:
                event_count_text += (
                    f"\n:tada: {percentage_diff:.0%} lower than last {COMPARISON_PERIOD}d avg"
                )

            blocks.append(self.get_markdown_block(event_count_text))

            # Add Top 3 Error Issues
            if context.key_errors:
                top_errors_text = "*Today's Top 3 Error Issues*\n"
                for error in context.key_errors:
                    linked_title = self.linkify_error_title(error[0])
                    top_errors_text += f"• {linked_title}"
                blocks.append(self.get_markdown_block(top_errors_text))

            # Add escalated/regressed issues
            if context.escalated_today or context.regressed_today:
                issue_state_text = "*Issues that escalated or regressed today*\n"
                if context.escalated_today:
                    for escalated_issue in context.escalated_today:
                        linked_title = self.linkify_error_title(escalated_issue)
                        issue_state_text += f"• :point_up: {linked_title}\n"
                    blocks.append(self.get_markdown_block(issue_state_text))

                if context.regressed_today:
                    for regressed_issue in context.regressed_today:
                        linked_title = self.linkify_error_title(regressed_issue)
                        issue_state_text += f"• :recycle: {linked_title}\n"
                    blocks.append(self.get_markdown_block(issue_state_text))

            blocks.append(self.get_divider())

            # Add performance data
            if context.key_performance_issues:
                top_perf_issues_text = "*Today's Top 3 Performance Issues*\n"
                for perf_issue in context.key_performance_issues:
                    linked_title = self.linkify_error_title(perf_issue[0])
                    top_perf_issues_text += f"• {linked_title}\n"
                blocks.append(self.get_markdown_block(top_perf_issues_text))

        text = "here is some text"
        callback_id_raw = self.notification.get_callback_data()
        callback_id = json.dumps(callback_id_raw) if callback_id_raw else None
        footer = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.SLACK
        )
        if footer:
            blocks.append(self.get_context_block(text=footer))

        return self._build_blocks(
            *blocks, fallback_text=text if text else None, callback_id=callback_id
        )
