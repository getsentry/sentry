from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.models import Group
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


def build_issue_block(group: Group) -> str:
    return SlackIssuesMessageBuilder(group)._build_as_block()


class SlackIssuesHelpMessageBuilder(SlackHelpMessageBuilder):
    """Help message tree. This inherits a constructor that expects a command."""

    def build(self) -> SlackBody:
        return self._build_blocks(
            self.get_markdown_block("Available commands are `inbox` and `triage`."),
            self.get_docs_block(),
        )


class SlackInboxMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, issues: CursorResult) -> None:
        super().__init__()
        self.issues = issues

    def build_str(self) -> str:
        blocks = [get_issues_message(self.issues)]

        for issue in self.issues[:ISSUES_INBOX_MAXIMUM]:
            blocks.append(SlackIssuesMessageBuilder(issue)._build_as_block())

        return "\n".join(blocks)
