from collections.abc import Mapping
from typing import Any

from slack_sdk.models.blocks import (
    ContextBlock,
    DividerBlock,
    HeaderBlock,
    MarkdownBlock,
    RichTextBlock,
    SectionBlock,
)
from slack_sdk.models.blocks.block_elements import RichTextElementParts, RichTextSectionElement

from sentry.seer.entrypoints.slack.mention import (
    IssueLink,
    SlackMessageLink,
    _extract_attachment_text,
    _extract_block_text,
    _extract_text_from_attachments,
    _extract_text_from_blocks,
    build_linked_messages_context,
    build_thread_context,
    extract_issue_links,
    extract_prompt,
    extract_slack_message_links,
    find_message_in_attachments,
)
from sentry.testutils.cases import TestCase

BOT_USER_ID = "U0BOT123"


class ExtractPromptTest(TestCase):
    def test_removes_bot_mention(self) -> None:
        text = "<@U0BOT123> fix this issue"
        assert extract_prompt(text, BOT_USER_ID) == "fix this issue"

    def test_removes_bot_mention_in_middle(self) -> None:
        text = "hey <@U0BOT123> fix this issue"
        assert extract_prompt(text, BOT_USER_ID) == "hey fix this issue"

    def test_preserves_other_user_mentions(self) -> None:
        text = "<@U0BOT123> ask <@U0USER456> about this"
        assert extract_prompt(text, BOT_USER_ID) == "ask <@U0USER456> about this"

    def test_preserves_non_mention_content(self) -> None:
        text = "<@U0BOT123> What is causing https://sentry.io/issues/123/ ?"
        assert (
            extract_prompt(text, BOT_USER_ID) == "What is causing https://sentry.io/issues/123/ ?"
        )

    def test_empty_after_mention(self) -> None:
        text = "<@U0BOT123>"
        assert extract_prompt(text, BOT_USER_ID) == ""

    def test_no_mentions(self) -> None:
        text = "just a regular message"
        assert extract_prompt(text, BOT_USER_ID) == "just a regular message"

    def test_collapses_extra_spaces(self) -> None:
        text = "<@U0BOT123>  fix  this"
        assert extract_prompt(text, BOT_USER_ID) == "fix this"

    def test_preserves_slack_url_formatting(self) -> None:
        text = "<@U0BOT123> check <https://sentry.io/issues/123/|ISSUE-123>"
        assert (
            extract_prompt(text, BOT_USER_ID) == "check <https://sentry.io/issues/123/|ISSUE-123>"
        )


class ExtractIssueLinksTest(TestCase):
    def test_standard_issue_url(self) -> None:
        text = "check <https://sentry.io/organizations/test-org/issues/456/|ISSUE-456>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=456)]

    def test_issue_url_with_event(self) -> None:
        text = "see <https://sentry.io/organizations/test-org/issues/789/events/abc123/|link>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=789, event_id="abc123")]

    def test_customer_domain_issue_url(self) -> None:
        text = "look at <https://test-org.sentry.io/issues/321/|issue>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=321)]

    def test_multiple_issue_urls(self) -> None:
        text = (
            "<https://sentry.io/organizations/test-org/issues/111/|one> "
            "and <https://sentry.io/organizations/test-org/issues/222/|two>"
        )
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=111), IssueLink(group_id=222)]

    def test_deduplicates_same_issue(self) -> None:
        text = (
            "<https://sentry.io/organizations/test-org/issues/111/|first> "
            "<https://sentry.io/organizations/test-org/issues/111/|second>"
        )
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=111)]

    def test_no_issue_urls(self) -> None:
        text = "no links here, just text"
        assert extract_issue_links(text) == []

    def test_ignores_non_issue_urls(self) -> None:
        text = "<https://google.com|Google> and <https://sentry.io/organizations/test-org/issues/999/|issue>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=999)]

    def test_plain_url_without_label(self) -> None:
        text = "<https://sentry.io/organizations/test-org/issues/555/>"
        result = extract_issue_links(text)
        assert result == [IssueLink(group_id=555)]

    def test_ignores_metric_alert_urls(self) -> None:
        text = "<https://sentry.io/organizations/test-org/alerts/rules/details/42/|alert>"
        assert extract_issue_links(text) == []


class ExtractBlockTextTest(TestCase):
    def test_section_block(self):
        block = SectionBlock(text="hello *world*").to_dict()
        assert _extract_block_text(block) == "hello *world*"

    def test_section_block_with_fields(self):
        block = SectionBlock(
            fields=[
                {"type": "mrkdwn", "text": "*Priority*"},
                {"type": "plain_text", "text": "High"},
            ]
        ).to_dict()
        result = _extract_block_text(block)
        assert "*Priority*" in result
        assert "High" in result

    def test_context_block(self):
        block = ContextBlock(
            elements=[{"type": "mrkdwn", "text": "Project: test-project"}]
        ).to_dict()
        assert _extract_block_text(block) == "Project: test-project"

    def test_header_block(self):
        block = HeaderBlock(text="My Header").to_dict()
        assert _extract_block_text(block) == "My Header"

    def test_markdown_block(self):
        block = MarkdownBlock(text="markdown content").to_dict()
        assert _extract_block_text(block) == "markdown content"

    def test_rich_text_with_text_and_link(self):
        block = RichTextBlock(
            elements=[
                RichTextSectionElement(
                    elements=[
                        RichTextElementParts.Text(text="Check "),
                        RichTextElementParts.Link(
                            url="https://sentry.io/organizations/test-org/issues/123/",
                            text="ISSUE-123",
                        ),
                    ]
                )
            ]
        ).to_dict()
        result = _extract_block_text(block)
        assert result == "Check <https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>"

    def test_rich_text_link_without_label(self):
        block = RichTextBlock(
            elements=[
                RichTextSectionElement(
                    elements=[
                        RichTextElementParts.Link(url="https://example.com"),
                    ]
                )
            ]
        ).to_dict()
        assert _extract_block_text(block) == "<https://example.com>"

    def test_rich_text_with_user_and_channel(self):
        block = RichTextBlock(
            elements=[
                RichTextSectionElement(
                    elements=[
                        RichTextElementParts.Text(text="Hey "),
                        RichTextElementParts.User(user_id="U123"),
                        RichTextElementParts.Text(text=" check "),
                        RichTextElementParts.Channel(channel_id="C456"),
                    ]
                )
            ]
        ).to_dict()
        assert _extract_block_text(block) == "Hey <@U123> check <#C456>"

    def test_rich_text_with_emoji(self):
        block = RichTextBlock(
            elements=[
                RichTextSectionElement(
                    elements=[
                        RichTextElementParts.Emoji(name="wave"),
                        RichTextElementParts.Text(text=" hello"),
                    ]
                )
            ]
        ).to_dict()
        assert _extract_block_text(block) == ":wave: hello"

    def test_divider_returns_empty(self):
        assert _extract_block_text(DividerBlock().to_dict()) == ""

    def test_actions_block_returns_empty(self):
        block = {
            "type": "actions",
            "elements": [{"type": "button", "text": {"type": "plain_text", "text": "Click"}}],
        }
        assert _extract_block_text(block) == ""


class ExtractTextFromBlocksTest(TestCase):
    def test_multiple_blocks(self):
        blocks = [
            HeaderBlock(text="Alert Title").to_dict(),
            SectionBlock(text="Something broke").to_dict(),
            DividerBlock().to_dict(),
            ContextBlock(elements=[{"type": "mrkdwn", "text": "Project: my-project"}]).to_dict(),
        ]
        result = _extract_text_from_blocks(blocks)
        assert result == "Alert Title\nSomething broke\nProject: my-project"

    def test_sentry_alert_like_blocks(self):
        blocks = [
            SectionBlock(
                text=":red_circle: <https://sentry.io/organizations/test-org/issues/456/|*ValueError: invalid input*>"
            ).to_dict(),
            ContextBlock(
                elements=[{"type": "mrkdwn", "text": "my_module.views in handle_request"}]
            ).to_dict(),
            SectionBlock(text="```invalid literal for int()```").to_dict(),
            ContextBlock(
                elements=[
                    {
                        "type": "mrkdwn",
                        "text": "Project: <https://sentry.io/projects/backend/|backend>    Alert: My Alert    Short ID: BACKEND-123",
                    }
                ]
            ).to_dict(),
        ]
        result = _extract_text_from_blocks(blocks)
        assert "https://sentry.io/organizations/test-org/issues/456/" in result
        assert "ValueError: invalid input" in result
        assert "invalid literal for int()" in result
        assert "Project:" in result


class BuildThreadContextTest(TestCase):
    def test_single_message(self) -> None:
        messages = [{"user": "U123", "text": "hello world", "ts": "1234567890.000001"}]
        result = build_thread_context(messages)
        assert result == "<@U123>: hello world"

    def test_multiple_messages(self) -> None:
        messages = [
            {"user": "U123", "text": "first message", "ts": "1234567890.000001"},
            {"user": "U456", "text": "second message", "ts": "1234567890.000002"},
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: first message\n<@U456>: second message"

    def test_empty_messages(self) -> None:
        assert build_thread_context([]) == ""

    def test_skips_empty_text(self) -> None:
        messages = [
            {"user": "U123", "text": "hello", "ts": "1234567890.000001"},
            {"user": "U456", "text": "", "ts": "1234567890.000002"},
            {"user": "U789", "text": "world", "ts": "1234567890.000003"},
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: hello\n<@U789>: world"

    def test_missing_user_defaults_to_unknown(self) -> None:
        messages = [{"text": "orphan message", "ts": "1234567890.000001"}]
        result = build_thread_context(messages)
        assert result == "<@unknown>: orphan message"

    def test_preserves_urls_in_text(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "check <https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>",
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "<https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>" in result

    def test_prefers_blocks_over_text(self):
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [SectionBlock(text="rich block content").to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: rich block content"
        assert "fallback text" not in result

    def test_falls_back_to_text_when_blocks_empty(self):
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: fallback text"

    def test_falls_back_to_text_when_blocks_have_no_text(self):
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [DividerBlock().to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: fallback text"

    def test_extracts_links_from_rich_text_blocks(self):
        messages = [
            {
                "user": "U123",
                "text": "fallback with no links",
                "blocks": [
                    RichTextBlock(
                        elements=[
                            RichTextSectionElement(
                                elements=[
                                    RichTextElementParts.Text(text="Check "),
                                    RichTextElementParts.Link(
                                        url="https://sentry.io/organizations/test-org/issues/999/",
                                        text="this issue",
                                    ),
                                ]
                            )
                        ]
                    ).to_dict()
                ],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "https://sentry.io/organizations/test-org/issues/999/" in result
        assert "this issue" in result

    def test_mixed_block_and_text_messages(self):
        messages: list[Mapping[str, Any]] = [
            {
                "user": "U123",
                "text": "alert fallback",
                "blocks": [SectionBlock(text="alert from blocks").to_dict()],
                "ts": "1234567890.000001",
            },
            {
                "user": "U456",
                "text": "plain text reply",
                "ts": "1234567890.000002",
            },
        ]
        result = build_thread_context(messages)
        assert result == "<@U123>: alert from blocks\n<@U456>: plain text reply"

    def test_markdown_block_in_seer_response(self):
        messages = [
            {
                "user": "UBOT",
                "text": "fallback",
                "blocks": [MarkdownBlock(text="Here is the Seer analysis...").to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "<@UBOT>: Here is the Seer analysis..."

    def test_extracts_attachments_when_no_blocks_or_text(self):
        messages = [
            {
                "user": "UBOT",
                "attachments": [
                    {
                        "title": "ValueError: invalid input",
                        "title_link": "https://sentry.io/organizations/test-org/issues/456/",
                        "text": "invalid literal for int()",
                    }
                ],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "<@UBOT>:" in result
        assert (
            "<https://sentry.io/organizations/test-org/issues/456/|ValueError: invalid input>"
            in result
        )
        assert "invalid literal for int()" in result

    def test_includes_both_top_level_text_and_attachments(self):
        messages = [
            {
                "user": "U123",
                "text": "top level message",
                "attachments": [{"text": "attachment body"}],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "<@U123>:" in result
        assert "top level message" in result
        assert "attachment body" in result

    def test_extracts_attachments_when_text_empty(self):
        messages = [
            {
                "user": "UBOT",
                "text": "",
                "attachments": [{"text": "attachment body"}],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "<@UBOT>: attachment body"


class ExtractAttachmentTextTest(TestCase):
    def test_legacy_attachment_with_title_and_text(self):
        attachment = {
            "title": "ValueError: invalid input",
            "title_link": "https://sentry.io/organizations/test-org/issues/456/",
            "text": "invalid literal for int()",
        }
        result = _extract_attachment_text(attachment)
        assert (
            "<https://sentry.io/organizations/test-org/issues/456/|ValueError: invalid input>"
            in result
        )
        assert "invalid literal for int()" in result

    def test_legacy_attachment_title_without_link(self):
        attachment = {"title": "Just a title", "text": "body"}
        result = _extract_attachment_text(attachment)
        assert result == "Just a title\nbody"

    def test_legacy_attachment_with_pretext(self):
        attachment = {"pretext": "Heads up:", "text": "something happened"}
        result = _extract_attachment_text(attachment)
        assert result == "Heads up:\nsomething happened"

    def test_legacy_attachment_with_fields(self):
        attachment = {
            "title": "Alert fired",
            "fields": [
                {"title": "Project", "value": "backend", "short": True},
                {"title": "Environment", "value": "prod", "short": True},
            ],
        }
        result = _extract_attachment_text(attachment)
        assert "Alert fired" in result
        assert "Project: backend" in result
        assert "Environment: prod" in result

    def test_legacy_attachment_field_value_only(self):
        attachment = {"fields": [{"value": "no title here"}]}
        assert _extract_attachment_text(attachment) == "no title here"

    def test_attachment_with_blocks_prefers_blocks(self):
        attachment = {
            "fallback": "should not be used",
            "text": "should not be used",
            "blocks": [SectionBlock(text="block content").to_dict()],
        }
        assert _extract_attachment_text(attachment) == "block content"

    def test_message_unfurl_attachment_uses_message_blocks(self):
        # Slack message-unfurl attachments embed the source message's blocks
        # one level deeper, in ``message_blocks[0].message.blocks``.
        attachment = {
            "is_msg_unfurl": True,
            "from_url": "https://acme.slack.com/archives/C0/p1700000000111111",
            "channel_id": "C0",
            "ts": "1700000000.111111",
            "text": "flat fallback (should not be used)",
            "message_blocks": [
                {
                    "team": "T1",
                    "channel": "C0",
                    "ts": "1700000000.111111",
                    "message": {
                        "blocks": [SectionBlock(text="rich body").to_dict()],
                    },
                }
            ],
        }
        assert _extract_attachment_text(attachment) == "rich body"

    def test_message_unfurl_falls_back_to_text_when_message_blocks_empty(self):
        attachment = {
            "is_msg_unfurl": True,
            "channel_id": "C0",
            "ts": "1700000000.111111",
            "text": "flat fallback",
            "message_blocks": [],
        }
        assert _extract_attachment_text(attachment) == "flat fallback"

    def test_attachment_falls_back_to_fallback_field(self):
        attachment = {"fallback": "Sentry alert: ValueError in backend"}
        assert _extract_attachment_text(attachment) == "Sentry alert: ValueError in backend"

    def test_attachment_skips_fallback_when_other_fields_present(self):
        attachment = {"text": "main body", "fallback": "ignored"}
        assert _extract_attachment_text(attachment) == "main body"

    def test_empty_attachment(self):
        assert _extract_attachment_text({}) == ""


class ExtractTextFromAttachmentsTest(TestCase):
    def test_multiple_attachments_joined(self):
        attachments: list[Mapping[str, Any]] = [
            {"text": "first"},
            {"text": "second"},
        ]
        assert _extract_text_from_attachments(attachments) == "first\nsecond"

    def test_skips_empty_attachments(self):
        attachments: list[Mapping[str, Any]] = [
            {"text": "first"},
            {},
            {"text": "second"},
        ]
        assert _extract_text_from_attachments(attachments) == "first\nsecond"

    def test_skips_non_dict_entries(self):
        attachments: list[Any] = [{"text": "first"}, "not-a-dict", {"text": "second"}]
        assert _extract_text_from_attachments(attachments) == "first\nsecond"


class ExtractSlackMessageLinksTest(TestCase):
    def test_top_level_permalink(self) -> None:
        text = "<https://acme.slack.com/archives/C0123456/p1700000000123456>"
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [
            SlackMessageLink(channel_id="C0123456", ts="1700000000.123456", thread_ts=None)
        ]

    def test_top_level_permalink_with_label(self) -> None:
        text = "see <https://acme.slack.com/archives/C0123456/p1700000000123456|earlier discussion>"
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [
            SlackMessageLink(channel_id="C0123456", ts="1700000000.123456", thread_ts=None)
        ]

    def test_threaded_permalink(self) -> None:
        text = (
            "<https://acme.slack.com/archives/C0123456/p1700000000999999"
            "?thread_ts=1700000000.123456&cid=C0123456>"
        )
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [
            SlackMessageLink(
                channel_id="C0123456",
                ts="1700000000.999999",
                thread_ts="1700000000.123456",
            )
        ]

    def test_multiple_permalinks(self) -> None:
        text = (
            "compare <https://acme.slack.com/archives/C0123456/p1700000000111111> "
            "and <https://acme.slack.com/archives/C0123456/p1700000000222222|second>"
        )
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [
            SlackMessageLink(channel_id="C0123456", ts="1700000000.111111"),
            SlackMessageLink(channel_id="C0123456", ts="1700000000.222222"),
        ]

    def test_dedups_same_link(self) -> None:
        text = (
            "<https://acme.slack.com/archives/C0123456/p1700000000111111|one> "
            "<https://acme.slack.com/archives/C0123456/p1700000000111111|same>"
        )
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [SlackMessageLink(channel_id="C0123456", ts="1700000000.111111")]

    def test_filters_other_workspace_when_domain_provided(self) -> None:
        text = (
            "ours <https://acme.slack.com/archives/C0123456/p1700000000111111> "
            "theirs <https://other.slack.com/archives/C0123456/p1700000000222222>"
        )
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [SlackMessageLink(channel_id="C0123456", ts="1700000000.111111")]

    def test_doesnt_accept_any_workspace_when_domain_missing(self) -> None:
        text = (
            "<https://acme.slack.com/archives/C0123456/p1700000000111111> "
            "<https://other.slack.com/archives/C0123456/p1700000000222222>"
        )
        result = extract_slack_message_links(text)
        assert len(result) == 0

    def test_ignores_non_slack_urls(self) -> None:
        text = "<https://sentry.io> <https://acme.slack.com/archives/C0123456/p1700000000111111>"
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == [SlackMessageLink(channel_id="C0123456", ts="1700000000.111111")]

    def test_ignores_non_message_slack_urls(self) -> None:
        # Slack channel link without a /pXXXX message component should not match.
        text = "<https://acme.slack.com/archives/C0123456>"
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == []

    def test_ignores_malformed_p_ts(self) -> None:
        text = "<https://acme.slack.com/archives/C0123456/p123>"
        result = extract_slack_message_links(text, domain_name="acme.slack.com")
        assert result == []

    def test_no_links(self) -> None:
        result = extract_slack_message_links("just texting", domain_name="acme.slack.com")
        assert result == []


class BuildLinkedMessagesContextTest(TestCase):
    """``build_linked_messages_context`` just prepends a header per block and
    delegates body rendering to ``build_thread_context`` (tested above), so
    these tests cover only the header / skip / join logic it adds."""

    def test_prepends_message_header(self) -> None:
        link = SlackMessageLink(channel_id="C0123456", ts="1700000000.111111")
        result = build_linked_messages_context(
            [(link, [{"user": "U1", "text": "body", "ts": "1700000000.111111"}])]
        )
        assert result == "User linked a Slack message in <#C0123456>:\n<@U1>: body"

    def test_skips_blocks_with_empty_messages(self) -> None:
        link_a = SlackMessageLink(channel_id="C0AAA", ts="1700000000.111111")
        link_b = SlackMessageLink(channel_id="C0BBB", ts="1700000000.222222")
        result = build_linked_messages_context(
            [(link_a, []), (link_b, [{"user": "U2", "text": "kept", "ts": "1700000000.222222"}])]
        )
        assert "<#C0AAA>" not in result
        assert "<#C0BBB>" in result

    def test_joins_multiple_blocks_with_blank_line(self) -> None:
        link_a = SlackMessageLink(channel_id="C0AAA", ts="1700000000.111111")
        link_b = SlackMessageLink(channel_id="C0BBB", ts="1700000000.222222")
        result = build_linked_messages_context(
            [
                (link_a, [{"user": "U1", "text": "a", "ts": "1700000000.111111"}]),
                (link_b, [{"user": "U2", "text": "b", "ts": "1700000000.222222"}]),
            ]
        )
        assert "\n\n" in result
        assert result.index("<#C0AAA>") < result.index("<#C0BBB>")


class FindMessageInAttachmentsTest(TestCase):
    LINK = SlackMessageLink(channel_id="C0123456", ts="1700000000.111111")

    def test_returns_none_when_attachments_missing(self) -> None:
        assert find_message_in_attachments(self.LINK, None) is None
        assert find_message_in_attachments(self.LINK, []) is None

    def test_matches_on_channel_id_and_ts(self) -> None:
        attachments = [
            {
                "channel_id": "C0123456",
                "ts": "1700000000.111111",
                "author_id": "U123",
                "text": "hello",
            }
        ]
        result = find_message_in_attachments(self.LINK, attachments)
        assert result == {
            "user": "U123",
            "ts": "1700000000.111111",
            "text": "hello",
        }

    def test_returns_none_when_no_attachment_matches(self) -> None:
        attachments = [
            {
                "channel_id": "C9999OTHER",
                "ts": "1700000000.111111",
                "author_id": "U123",
                "text": "different channel",
            },
            {
                "channel_id": "C0123456",
                "ts": "1700000000.999999",
                "author_id": "U456",
                "text": "different ts",
            },
        ]
        assert find_message_in_attachments(self.LINK, attachments) is None

    def test_skips_non_dict_entries(self) -> None:
        attachments: list[Any] = [
            "not-a-dict",
            {
                "channel_id": "C0123456",
                "ts": "1700000000.111111",
                "author_id": "U123",
                "text": "ok",
            },
        ]
        result = find_message_in_attachments(self.LINK, attachments)
        assert result is not None
        assert result["text"] == "ok"

    def test_missing_author_id_defaults_to_empty_string(self) -> None:
        attachments = [
            {
                "channel_id": "C0123456",
                "ts": "1700000000.111111",
                "text": "no author",
            }
        ]
        result = find_message_in_attachments(self.LINK, attachments)
        assert result is not None
        assert result["user"] == ""
