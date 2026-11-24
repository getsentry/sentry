from collections.abc import Mapping
from typing import Any

import orjson
from slack_sdk.models.blocks import (
    ContextBlock,
    DividerBlock,
    HeaderBlock,
    MarkdownBlock,
    RichTextBlock,
    SectionBlock,
)
from slack_sdk.models.blocks.block_elements import RichTextElementParts, RichTextSectionElement

from sentry.issues.grouptype import FeedbackGroup
from sentry.seer.entrypoints.slack.mention import (
    IssueLink,
    SlackMessageLink,
    _extract_attachment_text,
    _extract_block_text,
    _extract_text_from_attachments,
    _extract_text_from_blocks,
    build_linked_messages_context,
    build_referenced_issues_context,
    build_thread_context,
    extract_alert_issue_ids,
    extract_issue_links,
    extract_prompt,
    extract_slack_message_links,
    extract_thread_text,
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
    def test_section_block(self) -> None:
        block = SectionBlock(text="hello *world*").to_dict()
        assert _extract_block_text(block) == "hello *world*"

    def test_section_block_with_fields(self) -> None:
        block = SectionBlock(
            fields=[
                {"type": "mrkdwn", "text": "*Priority*"},
                {"type": "plain_text", "text": "High"},
            ]
        ).to_dict()
        result = _extract_block_text(block)
        assert "*Priority*" in result
        assert "High" in result

    def test_context_block(self) -> None:
        block = ContextBlock(
            elements=[{"type": "mrkdwn", "text": "Project: test-project"}]
        ).to_dict()
        assert _extract_block_text(block) == "Project: test-project"

    def test_header_block(self) -> None:
        block = HeaderBlock(text="My Header").to_dict()
        assert _extract_block_text(block) == "My Header"

    def test_markdown_block(self) -> None:
        block = MarkdownBlock(text="markdown content").to_dict()
        assert _extract_block_text(block) == "markdown content"

    def test_rich_text_with_text_and_link(self) -> None:
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

    def test_rich_text_link_without_label(self) -> None:
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

    def test_rich_text_with_user_and_channel(self) -> None:
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

    def test_rich_text_with_emoji(self) -> None:
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

    def test_divider_returns_empty(self) -> None:
        assert _extract_block_text(DividerBlock().to_dict()) == ""

    def test_actions_block_returns_empty(self) -> None:
        block = {
            "type": "actions",
            "elements": [{"type": "button", "text": {"type": "plain_text", "text": "Click"}}],
        }
        assert _extract_block_text(block) == ""


class ExtractTextFromBlocksTest(TestCase):
    def test_multiple_blocks(self) -> None:
        blocks = [
            HeaderBlock(text="Alert Title").to_dict(),
            SectionBlock(text="Something broke").to_dict(),
            DividerBlock().to_dict(),
            ContextBlock(elements=[{"type": "mrkdwn", "text": "Project: my-project"}]).to_dict(),
        ]
        result = _extract_text_from_blocks(blocks)
        assert result == "Alert Title\nSomething broke\nProject: my-project"

    def test_sentry_alert_like_blocks(self) -> None:
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
        assert result == "User <@U123>: hello world"

    def test_multiple_messages(self) -> None:
        messages = [
            {"user": "U123", "text": "first message", "ts": "1234567890.000001"},
            {"user": "U456", "text": "second message", "ts": "1234567890.000002"},
        ]
        result = build_thread_context(messages)
        assert result == "User <@U123>: first message\nUser <@U456>: second message"

    def test_empty_messages(self) -> None:
        assert build_thread_context([]) == ""

    def test_skips_empty_text(self) -> None:
        messages = [
            {"user": "U123", "text": "hello", "ts": "1234567890.000001"},
            {"user": "U456", "text": "", "ts": "1234567890.000002"},
            {"user": "U789", "text": "world", "ts": "1234567890.000003"},
        ]
        result = build_thread_context(messages)
        assert result == "User <@U123>: hello\nUser <@U789>: world"

    def test_missing_user_defaults_to_unknown(self) -> None:
        messages = [{"text": "orphan message", "ts": "1234567890.000001"}]
        result = build_thread_context(messages)
        assert result == "User <@unknown>: orphan message"

    def test_converts_slack_links_to_markdown(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "check <https://sentry.io/organizations/test-org/issues/123/|ISSUE-123>",
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "[ISSUE-123](https://sentry.io/organizations/test-org/issues/123/)" in result

    def test_prefers_blocks_over_text(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [SectionBlock(text="rich block content").to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "User <@U123>: rich block content"
        assert "fallback text" not in result

    def test_falls_back_to_text_when_blocks_empty(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "User <@U123>: fallback text"

    def test_falls_back_to_text_when_blocks_have_no_text(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "fallback text",
                "blocks": [DividerBlock().to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "User <@U123>: fallback text"

    def test_extracts_links_from_rich_text_blocks(self) -> None:
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

    def test_mixed_block_and_text_messages(self) -> None:
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
        assert result == "User <@U123>: alert from blocks\nUser <@U456>: plain text reply"

    def test_markdown_block_in_seer_response(self) -> None:
        messages = [
            {
                "user": "UBOT",
                "text": "fallback",
                "blocks": [MarkdownBlock(text="Here is the Seer analysis...").to_dict()],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "User <@UBOT>: Here is the Seer analysis..."

    def test_extracts_attachments_when_no_blocks_or_text(self) -> None:
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
        assert "User <@UBOT>:" in result
        assert (
            "[ValueError: invalid input](https://sentry.io/organizations/test-org/issues/456/)"
            in result
        )
        assert "invalid literal for int()" in result

    def test_includes_both_top_level_text_and_attachments(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": "top level message",
                "attachments": [{"text": "attachment body"}],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert "User <@U123>:" in result
        assert "top level message" in result
        assert "attachment body" in result

    def test_extracts_attachments_when_text_empty(self) -> None:
        messages = [
            {
                "user": "UBOT",
                "text": "",
                "attachments": [{"text": "attachment body"}],
                "ts": "1234567890.000001",
            }
        ]
        result = build_thread_context(messages)
        assert result == "User <@UBOT>: attachment body"


def _alert_message(issue_id: int, *, user: str = BOT_USER_ID) -> dict[str, Any]:
    return {
        "user": user,
        "text": "fallback",
        "blocks": [
            {
                "type": "section",
                "block_id": orjson.dumps({"issue": issue_id, "workflow": 7}).decode(),
                "text": {"type": "mrkdwn", "text": "*New Issue*"},
            },
            {"type": "context", "elements": [{"type": "mrkdwn", "text": "Short ID: PROJ-1"}]},
        ],
        "ts": "1234567890.000001",
    }


class BuildThreadContextRolesTest(TestCase):
    def test_labels_alerts_own_replies_and_users(self) -> None:
        messages = [
            _alert_message(123),
            {"user": "U123", "text": f"<@{BOT_USER_ID}> what is this?", "ts": "2"},
            {"user": BOT_USER_ID, "text": "It looks like a timeout.", "ts": "3"},
        ]
        result = build_thread_context(messages, bot_user_id=BOT_USER_ID)
        assert result.splitlines() == [
            "Sentry alert: *New Issue*",
            "Short ID: PROJ-1",
            "User <@U123>: @Sentry what is this?",
            "Sentry (you), earlier reply: It looks like a timeout.",
        ]

    def test_drops_own_replies_but_keeps_alerts(self) -> None:
        messages = [
            _alert_message(123),
            {"user": BOT_USER_ID, "text": "It looks like a timeout.", "ts": "3"},
            {"user": "U123", "text": "are you sure?", "ts": "4"},
        ]
        result = build_thread_context(messages, bot_user_id=BOT_USER_ID, include_own_replies=False)
        assert "Sentry alert:" in result
        assert "User <@U123>: are you sure?" in result
        assert "timeout" not in result

    def test_other_users_with_alert_block_id_are_users(self) -> None:
        result = build_thread_context([_alert_message(123, user="U999")], bot_user_id=BOT_USER_ID)
        assert result.startswith("User <@U999>:")

    def test_converts_slack_mrkdwn(self) -> None:
        messages = [
            {
                "user": "U123",
                "text": (
                    "Tom &amp; Jerry &lt;3 <https://example.com/a?b=1&amp;c=2|the page> "
                    "<https://example.com/bare> <mailto:user@example.com|user@example.com>"
                ),
                "ts": "1",
            }
        ]
        result = build_thread_context(messages, bot_user_id=BOT_USER_ID)
        assert result == (
            "User <@U123>: Tom & Jerry <3 [the page](https://example.com/a?b=1&c=2) "
            "https://example.com/bare user@example.com"
        )


class ExtractThreadTextTest(TestCase):
    def test_keeps_raw_slack_link_syntax(self) -> None:
        messages = [
            {"user": "U1", "text": "see <https://example.com/a?b=1&amp;c=2|page>"},
            {"user": "U2", "text": ""},
            {"user": BOT_USER_ID, "text": "reply"},
        ]
        assert extract_thread_text(messages) == (
            "see <https://example.com/a?b=1&amp;c=2|page>\nreply"
        )


class ExtractAlertIssueIdsTest(TestCase):
    def test_reads_issue_ids_from_own_messages(self) -> None:
        messages = [
            _alert_message(1),
            _alert_message(2, user="U999"),
            _alert_message(1),
            _alert_message(3),
            {"user": BOT_USER_ID, "blocks": [{"type": "section", "block_id": "{not json"}]},
            {"user": BOT_USER_ID, "blocks": [{"type": "section", "block_id": '{"issue": "4"}'}]},
        ]
        assert extract_alert_issue_ids(messages, bot_user_id=BOT_USER_ID) == [1, 3]

    def test_needs_bot_user_id(self) -> None:
        assert extract_alert_issue_ids([_alert_message(1)], bot_user_id=None) == []


class BuildReferencedIssuesContextTest(TestCase):
    def test_lists_only_identifiers_of_issues_in_the_org(self) -> None:
        project = self.create_project(organization=self.organization, slug="backend")
        group = self.create_group(project=project, message="secret title")
        feedback_group = self.create_group(project=project, type=FeedbackGroup.type_id)
        other_org = self.create_organization()
        other_group = self.create_group(project=self.create_project(organization=other_org))

        result = build_referenced_issues_context(
            organization=self.organization,
            issue_ids=[other_group.id, group.id, feedback_group.id],
        )

        lines = result.splitlines()
        assert "resolved these from the alert metadata" in lines[0]
        assert lines[1:] == [
            f"- org: {self.organization.slug}, issue_id: {group.id}, "
            f"short_id: {group.qualified_short_id}, project: backend, category: error, "
            f"url: {group.get_absolute_url()}",
            f"- org: {self.organization.slug}, issue_id: {feedback_group.id}, "
            f"short_id: {feedback_group.qualified_short_id}, project: backend, "
            f"category: feedback, url: {feedback_group.get_absolute_url()}",
        ]
        assert "secret title" not in result
        assert f"issue_id: {other_group.id}," not in result

    def test_caps_issue_count(self) -> None:
        groups = [self.create_group(project=self.project) for _ in range(5)]
        result = build_referenced_issues_context(
            organization=self.organization, issue_ids=[g.id for g in groups]
        )
        assert len(result.splitlines()) == 4

    def test_empty_when_nothing_resolves(self) -> None:
        other_group = self.create_group(
            project=self.create_project(organization=self.create_organization())
        )
        assert (
            build_referenced_issues_context(
                organization=self.organization, issue_ids=[other_group.id]
            )
            == ""
        )
        assert build_referenced_issues_context(organization=self.organization, issue_ids=[]) == ""


class ExtractAttachmentTextTest(TestCase):
    def test_legacy_attachment_with_title_and_text(self) -> None:
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

    def test_legacy_attachment_title_without_link(self) -> None:
        attachment = {"title": "Just a title", "text": "body"}
        result = _extract_attachment_text(attachment)
        assert result == "Just a title\nbody"

    def test_legacy_attachment_with_pretext(self) -> None:
        attachment = {"pretext": "Heads up:", "text": "something happened"}
        result = _extract_attachment_text(attachment)
        assert result == "Heads up:\nsomething happened"

    def test_legacy_attachment_with_fields(self) -> None:
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

    def test_legacy_attachment_field_value_only(self) -> None:
        attachment = {"fields": [{"value": "no title here"}]}
        assert _extract_attachment_text(attachment) == "no title here"

    def test_attachment_with_blocks_prefers_blocks(self) -> None:
        attachment = {
            "fallback": "should not be used",
            "text": "should not be used",
            "blocks": [SectionBlock(text="block content").to_dict()],
        }
        assert _extract_attachment_text(attachment) == "block content"

    def test_message_unfurl_attachment_uses_message_blocks(self) -> None:
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

    def test_message_unfurl_falls_back_to_text_when_message_blocks_empty(self) -> None:
        attachment = {
            "is_msg_unfurl": True,
            "channel_id": "C0",
            "ts": "1700000000.111111",
            "text": "flat fallback",
            "message_blocks": [],
        }
        assert _extract_attachment_text(attachment) == "flat fallback"

    def test_attachment_falls_back_to_fallback_field(self) -> None:
        attachment = {"fallback": "Sentry alert: ValueError in backend"}
        assert _extract_attachment_text(attachment) == "Sentry alert: ValueError in backend"

    def test_attachment_skips_fallback_when_other_fields_present(self) -> None:
        attachment = {"text": "main body", "fallback": "ignored"}
        assert _extract_attachment_text(attachment) == "main body"

    def test_empty_attachment(self) -> None:
        assert _extract_attachment_text({}) == ""


class ExtractTextFromAttachmentsTest(TestCase):
    def test_multiple_attachments_joined(self) -> None:
        attachments: list[Mapping[str, Any]] = [
            {"text": "first"},
            {"text": "second"},
        ]
        assert _extract_text_from_attachments(attachments) == "first\nsecond"

    def test_skips_empty_attachments(self) -> None:
        attachments: list[Mapping[str, Any]] = [
            {"text": "first"},
            {},
            {"text": "second"},
        ]
        assert _extract_text_from_attachments(attachments) == "first\nsecond"

    def test_skips_non_dict_entries(self) -> None:
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
        assert result == "User linked a Slack message in <#C0123456>:\nUser <@U1>: body"

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
