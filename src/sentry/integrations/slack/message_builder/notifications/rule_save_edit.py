from __future__ import annotations

from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models.rule import Rule
from sentry.utils.http import absolute_uri


class SlackRuleSaveEditMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        rules: list[Rule],
        new: bool,
        edited: bool,
    ) -> None:
        super().__init__()
        self.rule = rules[0]
        self.new = new
        self.edited = edited

    def linkify_rule(self):
        org_slug = self.rule.project.organization.slug
        project_slug = self.rule.project.slug
        rule_url_path = (
            f"/organizations/{org_slug}/alerts/rules/{project_slug}/{self.rule.id}/details/"
        )
        rule_url = absolute_uri(rule_url_path)
        rule_name = self.rule.label
        return f"<{rule_url}|*{escape_slack_text(rule_name)}*>"

    def build(self) -> SlackBlock:
        rule_url = self.linkify_rule()
        project = self.rule.project.slug
        if self.new:
            rule_text = f"{rule_url} was created in the {project} project and will send notifications to this channel."
        else:
            rule_text = f"{rule_url} was updated."
        # TODO add short summary of the trigger & filter conditions, plus a link to the notif setting
        blocks = [self.get_markdown_block(rule_text)]
        return self._build_blocks(*blocks, fallback_text=rule_text)
