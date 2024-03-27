from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from urllib.parse import urlencode

from sentry_relay.processing import parse_release

from sentry import features
from sentry.integrations.message_builder import build_attachment_text, build_attachment_title
from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.tasks.summaries.utils import COMPARISON_PERIOD
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.http import absolute_uri

from .base import SlackNotificationsMessageBuilder

MAX_CHARS_ONE_LINE = 35


class SlackDailySummaryMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def linkify_error_title(self, group):
        link = group.get_absolute_url(
            params={"referrer": self.notification.get_referrer(ExternalProviders.SLACK)}
        )
        title = build_attachment_title(group)
        formatted_title = self.truncate_text(title)
        attachment_text = self.get_attachment_text(group)
        if not attachment_text:
            return f"<{link}|*{escape_slack_text(formatted_title)}*>"
        formatted_attachment_text = attachment_text.replace("\n", " ")
        return f"<{link}|*{escape_slack_text(formatted_title)}*>\n{self.truncate_text(formatted_attachment_text)}"

    def linkify_release(self, release, organization):
        path = f"/releases/{release.version}/"
        url = organization.absolute_url(path)
        release_description = parse_release(release.version).get("description")
        return f":rocket: *<{url}|Release {release_description}>*\n"

    def truncate_text(self, text):
        if text and len(text) > MAX_CHARS_ONE_LINE:
            text = text[:MAX_CHARS_ONE_LINE] + "..."
        return text

    def get_attachment_text(self, group):
        attachment_text = build_attachment_text(group)
        return self.truncate_text(attachment_text)

    def build_discover_url(self, project):
        query_params = {
            "field": ["title", "event.type", "project", "user.display", "timestamp"],
            "name": "All Events",
            "project": project.id,
            "query": "event.type:error",
            "sort": "-timestamp",
            "statsPeriod": "24h",
            "yAxis": "count()",
        }
        query_string = urlencode(query_params, doseq=True)
        url = absolute_uri(
            f"/organizations/{project.organization.slug}/discover/homepage/?{query_string}"
        )
        return url

    def build(self) -> SlackBlock:
        blocks = []
        subject = self.notification.get_subject()
        blocks.append(
            self.get_markdown_block(
                f"*{subject}*\nYour comprehensive overview for today - key issues, performance insights, and more.",
                ":bell:",
            )
        )
        blocks.append(self.get_divider())

        for project_id, context in self.context.items():
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                continue

            if context.check_if_project_is_empty():
                continue

            project_text = f"Here's what happened in the *{project.slug}* project today:"
            blocks.append(self.get_markdown_block(project_text))

            fields = []
            event_count_text = "*Today’s Event Count*: "
            formatted_total_today = f"{context.total_today:,}"
            if features.has("organizations:discover", project.organization):
                discover_url = self.build_discover_url(project)
                event_count_text += f"<{discover_url}|{formatted_total_today}>"
            else:
                event_count_text += formatted_total_today
            fields.append(self.make_field(event_count_text))

            # Calculate today's event count percentage against 14 day avg
            if context.comparison_period_avg > 0:  # avoid a zerodivisionerror
                percentage_diff = context.total_today / context.comparison_period_avg
                if context.total_today > context.comparison_period_avg:
                    percentage_diff_text = (
                        f":warning: {percentage_diff:.0%} higher than last {COMPARISON_PERIOD}d avg"
                    )
                    fields.append(self.make_field(percentage_diff_text))
                else:
                    percentage_diff_text = (
                        f" :tada: {percentage_diff:.0%} lower than last {COMPARISON_PERIOD}d avg"
                    )
                    fields.append(self.make_field(percentage_diff_text))

            blocks.append(self.get_section_fields_block(fields))

            # Add release info if we have it
            if context.new_in_release:
                fields = []
                for release_id, errors in context.new_in_release.items():
                    try:
                        release = Release.objects.get(id=release_id)
                    except Release.DoesNotExist:
                        continue

                    release_text = self.linkify_release(release, project.organization)
                    for error in errors:
                        linked_issue_title = self.linkify_error_title(error)
                        release_text += f"• :new: {linked_issue_title}\n"
                        fields.append(self.make_field(release_text))
                blocks.append(self.get_section_fields_block(fields))

            # Add Top 3 Error Issues
            error_issue_fields = []
            if context.key_errors:
                top_errors_text = "*Today's Top 3 Error Issues*\n"
                for error in context.key_errors:
                    linked_title = self.linkify_error_title(error[0])
                    top_errors_text += f"• {linked_title}\n"
                error_issue_fields.append(self.make_field(top_errors_text))

            # Add escalated/regressed issues
            if context.escalated_today or context.regressed_today:
                issue_state_text = "*Issues that escalated or regressed today*\n"
                if context.escalated_today:
                    for escalated_issue in context.escalated_today:
                        linked_title = self.linkify_error_title(escalated_issue)
                        issue_state_text += f"• :point_up: {linked_title}\n"

                if context.regressed_today:
                    if not context.escalated_today:
                        issue_state_text = "*Issues that escalated or regressed today*\n"
                    for regressed_issue in context.regressed_today:
                        linked_title = self.linkify_error_title(regressed_issue)
                        issue_state_text += f"• :recycle: {linked_title}\n"

                error_issue_fields.append(self.make_field(issue_state_text))
            blocks.append(self.get_section_fields_block(error_issue_fields))

            # Add performance data
            if context.key_performance_issues:
                top_perf_issues_text = "*Today's Top 3 Performance Issues*\n"
                for perf_issue in context.key_performance_issues:
                    linked_title = self.linkify_error_title(perf_issue[0])
                    top_perf_issues_text += f"• {linked_title}\n"
                blocks.append(self.get_markdown_block(top_perf_issues_text))

            blocks.append(self.get_divider())

        text = subject
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
