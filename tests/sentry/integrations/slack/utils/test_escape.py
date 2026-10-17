from sentry.integrations.slack.utils.escape import (
    escape_slack_markdown_text,
    escape_slack_text,
)


class TestEscapeSlackText:
    def test_none_returns_empty_string(self):
        assert escape_slack_text(None) == ""

    def test_empty_string_returns_empty_string(self):
        assert escape_slack_text("") == ""

    def test_escapes_special_characters(self):
        assert escape_slack_text("<hello> & <world>") == "&lt;hello&gt; &amp; &lt;world&gt;"

    def test_collapses_newlines_to_spaces(self):
        assert escape_slack_text("the app freezes\n\nreproduced twice") == (
            "the app freezes reproduced twice"
        )

    def test_collapses_newlines_before_escaping_special_characters(self):
        assert escape_slack_text("<title>\nline two") == "&lt;title&gt; line two"

    def test_single_line_text_is_unaffected(self):
        assert escape_slack_text("a normal title") == "a normal title"


class TestEscapeSlackMarkdownText:
    def test_none_returns_empty_string(self):
        assert escape_slack_markdown_text(None) == ""

    def test_reduces_runs_of_backticks_to_one(self):
        assert escape_slack_markdown_text("```code```") == "`code`"
