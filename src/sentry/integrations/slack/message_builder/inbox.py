from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.utils.cursors import CursorResult

ISSUES_INBOX_MAXIMUM = 5
ISSUES_INBOX_MORE_MESSAGE = "There are {n} issues for your review. Here are the first {m} issues:"
ISSUES_INBOX_MESSAGE = "There are {n} issues for your review:"
ISSUES_INBOX_ONE_MESSAGE = "There is 1 issue for you to review:"
ISSUES_INBOX_ZERO_MESSAGE = "There are no for you to review!"


def get_issues_message(issues: CursorResult) -> str:
    issues_count = len(issues)
    if issues_count == 0:
        return ISSUES_INBOX_ZERO_MESSAGE

    if issues_count == 1:
        return ISSUES_INBOX_ONE_MESSAGE

    if issues_count <= ISSUES_INBOX_MAXIMUM:
        return ISSUES_INBOX_MESSAGE.format(n=issues_count)

    return ISSUES_INBOX_MORE_MESSAGE.format(n=issues_count, m=ISSUES_INBOX_MAXIMUM)


class SlackIssuesHelpMessageBuilder(SlackHelpMessageBuilder):
    """Help message tree. This inherits a constructor that expects a command."""

    def build(self) -> SlackBody:
        return self._build_blocks(
            self.get_markdown_block("TODO"),
            self.get_docs_block(),
        )


class SlackInboxMessageBuilder(SlackMessageBuilder):
    def build(self) -> SlackBody:
        return {}
