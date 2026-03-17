from sentry.seer.entrypoints.slack.mention import (
    IssueLink,
    build_thread_context,
    extract_issue_links,
    extract_prompt,
)
from sentry.testutils.cases import TestCase

BOT_USER_ID = "U0BOT123"


class ExtractPromptTest(TestCase):
    def test_removes_bot_mention(self):
        text = "<@U0BOT123> fix this issue"
        assert extract_prompt(text, BOT_USER_ID) == "fix this issue"

    def test_removes_bot_mention_in_middle(self):
        text = "hey <@U0BOT123> fix this issue"
        assert extract_prompt(text, BOT_USER_ID) == "hey fix this issue"

    def test_preserves_other_user_mentions(self):
        text = "<@U0BOT123> ask <@U0USER456> about this"
        assert extract_prompt(text, BOT_USER_ID) == "ask <@U0USER456> about this"

    def test_preserves_non_mention_content(self):
        text = "<@U0BOT123> What is causing https://sentry.io/issues/123/ ?"
        assert (
            extract_prompt(text, BOT_USER_ID) == "What is causing https://sentry.io/issues/123/ ?"
        )

    def test_empty_after_mention(self):
        text = "<@U0BOT123>"
        assert extract_prompt(text, BOT_USER_ID) == ""

    def test_no_mentions(self):
        text = "just a regular message"
        assert extract_prompt(text, BOT_USER_ID) == "just a regular message"

    def test_collapses_extra_spaces(self):
        text = "<@U0BOT123>  fix  this"
        assert extract_prompt(text, BOT_USER_ID) == "fix this"

    def test_preserves_slack_url_formatting(self):
        text = "<@U0BOT123> check <https://sentry.io/issues/123/|ISSUE-123>"
        assert (
            extract_prompt(text, BOT_USER_ID) == "check <https://sentry.io/issues/123/|ISSUE-123>"
        )


class ExtractIssueLinksTest(TestCase):
    def test_standard_issue_url(self):
        text = "check <https://sentry.io/organizations/test-org/issues/456/|ISSUE-456>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=456)]

    def test_issue_url_with_event(self):
        text = "see <https://sentry.io/organizations/test-org/issues/789/events/abc123/|link>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=789, event_id="abc123")]

    def test_customer_domain_issue_url(self):
        text = "look at <https://test-org.sentry.io/issues/321/|issue>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=321)]

    def test_multiple_issue_urls(self):
        text = (
            "<https://sentry.io/organizations/test-org/issues/111/|one> "
            "and <https://sentry.io/organizations/test-org/issues/222/|two>"
        )
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=111), IssueLink(group_id=222)]

    def test_deduplicates_same_issue(self):
        text = (
            "<https://sentry.io/organizations/test-org/issues/111/|first> "
            "<https://sentry.io/organizations/test-org/issues/111/|second>"
        )
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=111)]

    def test_no_issue_urls(self):
        text = "no links here, just text"
        assert extract_issue_links(text) == []

    def test_ignores_non_issue_urls(self):
        text = "<https://google.com|Google> and <https://sentry.io/organizations/test-org/issues/999/|issue>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=999)]

    def test_plain_url_without_label(self):
        text = "<https://sentry.io/organizations/test-org/issues/555/>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=555)]

    def test_ignores_metric_alert_urls(self):
        text = "<https://sentry.io/organizations/test-org/alerts/rules/details/42/|alert>"
        assert extract_issue_links(text) == []


class BuildThreadContextTest(TestCase):
    def test_single_message(self):
        messages = [{"user": "U123", "text": "hello world", "ts": "1234567890.000001"}]
        result = build_thread_context(messages)
        assert result == "<@U123>: hello world"

    def test_multiple_messages(self):
        messages = [
            {"user": "U123", "text": "first message", "ts": "1234567890.000001"},
            {"user": "U456", "text": "second message", "ts": "1234567890.000002"},
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: first message\n<@U456>: second message"

    def test_empty_messages(self):
        assert build_thread_context([]) == ""

    def test_skips_empty_text(self):
        messages = [
            {"user": "U123", "text": "hello", "ts": "1234567890.000001"},
            {"user": "U456", "text": "", "ts": "1234567890.000002"},
            {"user": "U789", "text": "world", "ts": "1234567890.000003"},
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: hello\n<@U789>: world"

    def test_missing_user_defaults_to_unknown(self):
        messages = [{"text": "orphan message", "ts": "1234567890.000001"}]
        result = build_thread_context(messages)
        assert result == "<@unknown>: orphan message"

    def test_preserves_urls_in_text(self):
        messages = [
            {
                "user": "U123",
                "text": "check <https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>",
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "<https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>" in result
