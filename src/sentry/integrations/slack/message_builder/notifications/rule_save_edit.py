from __future__ import annotations

from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.rule import Rule
from sentry.notifications.types import NotificationSettingEnum
from sentry.utils.http import absolute_uri


class SlackRuleSaveEditMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        rule: Rule,
        new: bool,
        changed: dict | None = None,
    ) -> None:
        super().__init__()
        self.rule = rule
        self.new = new
        self.changed = changed

    def linkify(self, org_slug: str, project_slug: str, url_str: str, url_text: str):
        url = absolute_uri(url_str)
        return f"<{url}|*{escape_slack_text(url_text)}*>"

    def get_settings_url(self):
        url_str = "/settings/account/notifications/"
        fine_tuning_key = NotificationSettingEnum.ISSUE_ALERTS.value
        url_str += f"{fine_tuning_key}/"
        url = str(self.rule.project.organization.absolute_url(url_str))
        return f"<{url}|*Notification Settings*>"

    def build(self) -> SlackBlock:
        blocks = []
        org_slug = self.rule.project.organization.slug
        project_slug = self.rule.project.slug
        rule_url_path = (
            f"/organizations/{org_slug}/alerts/rules/{project_slug}/{self.rule.id}/details/"
        )
        rule_name = self.rule.label
        rule_url = self.linkify(org_slug, project_slug, rule_url_path, rule_name)
        project_url_path = f"/organizations/{org_slug}/projects/{project_slug}/"
        project_url = self.linkify(org_slug, project_slug, project_url_path, project_slug)
        if self.new:
            rule_text = "*Alert rule created*\n\n"
            rule_text += f"{rule_url} was created in the {project_url} project and will send notifications to this channel."
        else:
            rule_text = "*Alert rule updated*\n\n"
            rule_text += f"{rule_url} in the {project_url} project was recently updated."
            # TODO: potentially use old name if it's changed?

        blocks.append(self.get_markdown_block(rule_text))

        if not self.new and self.changed:
            changes_text = "Changes\n"
            for changes in self.changed.values():
                for change in changes:
                    changes_text += f"• {change}\n"

            blocks.append(self.get_markdown_block(changes_text))

        settings_link = self.get_settings_url()
        blocks.append(self.get_context_block(settings_link))

        return self._build_blocks(*blocks, fallback_text=rule_text)
