from __future__ import annotations

from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.rule import Rule
from sentry.notifications.types import NotificationSettingEnum
from sentry.utils.http import absolute_uri


class SlackRuleSaveEditMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        rule: Rule,
        new: bool,
        changed: dict,
    ) -> None:
        super().__init__()
        self.rule = rule
        self.new = new
        self.changed = changed

    def linkify_rule(self):
        org_slug = self.rule.project.organization.slug
        project_slug = self.rule.project.slug
        rule_url_path = (
            f"/organizations/{org_slug}/alerts/rules/{project_slug}/{self.rule.id}/details/"
        )
        rule_url = absolute_uri(rule_url_path)
        rule_name = self.rule.label
        return f"<{rule_url}|*{escape_slack_text(rule_name)}*>"

    def get_settings_url(self):
        url_str = "/settings/account/notifications/"
        fine_tuning_key = NotificationSettingEnum.ISSUE_ALERTS.value
        url_str += f"{fine_tuning_key}/"
        url = str(self.rule.project.organization.absolute_url(url_str))
        return f"<{url}|*Notification Settings*>"

    def build(self) -> SlackBlock:
        blocks = []
        rule_url = self.linkify_rule()
        project = self.rule.project.slug
        if self.new:
            rule_text = f"Alert rule {rule_url} was created in the *{project}* project and will send notifications here."
        else:
            rule_text = f"Alert rule {rule_url} in the *{project}* project was updated."
            # TODO potentially use old name if it's changed?

        blocks.append(self.get_markdown_block(rule_text))

        if not self.new and self.changed:
            changes_text = "*Changes*\n"
            for label, changes in self.changed.items():
                for change in changes:
                    changes_text += f"• {change}\n"

            blocks.append(self.get_markdown_block(changes_text))

        settings_link = self.get_settings_url()
        blocks.append(self.get_context_block(settings_link))

        return self._build_blocks(*blocks, fallback_text=rule_text)
