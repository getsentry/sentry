from __future__ import annotations

from sentry.preprod.vcs.markdown_utils import escape_markdown, escape_markdown_code


class TestEscapeMarkdown:
    def test_empty_returns_default(self) -> None:
        assert escape_markdown(None) == ""
        assert escape_markdown("") == ""
        assert escape_markdown(None, default="--") == "--"
        assert escape_markdown("", default="--") == "--"

    def test_plain_text_unchanged(self) -> None:
        # Common, safe values must pass through untouched so output stays readable.
        assert escape_markdown("My App") == "My App"
        assert escape_markdown("com.example.app") == "com.example.app"
        assert escape_markdown("1.0.0 (42)") == "1.0.0 (42)"
        assert escape_markdown("Debug-Release") == "Debug-Release"

    def test_link_breakout_neutralized(self) -> None:
        # Defend against link injection.
        escaped = escape_markdown("App](https://sentry.io) [")
        assert "App](" not in escaped
        assert escaped == "App\\](https://sentry.io) \\["

    def test_escapes_inline_metacharacters(self) -> None:
        assert escape_markdown("a[b]c") == "a\\[b\\]c"
        assert escape_markdown("a`b") == "a\\`b"
        assert escape_markdown("a\\b") == "a\\\\b"

    def test_leaves_emphasis_chars_unescaped(self) -> None:
        # Emphasis is cosmetic-only and not part of the threat model; escaping it
        # would mangle common identifiers, so it is intentionally left alone.
        assert escape_markdown("my_app_name") == "my_app_name"
        assert escape_markdown("*bold*") == "*bold*"
        assert escape_markdown("~strike~") == "~strike~"

    def test_escapes_html_and_entities(self) -> None:
        assert escape_markdown("<img src=x>") == "\\<img src=x\\>"
        assert escape_markdown("&lt;") == "\\&lt;"

    def test_escapes_table_pipe(self) -> None:
        assert escape_markdown("a|b") == "a\\|b"

    def test_collapses_newlines(self) -> None:
        assert escape_markdown("line1\nline2") == "line1 line2"
        assert escape_markdown("line1\r\n\r\nline2") == "line1 line2"

    def test_leaves_bare_parens_and_dots(self) -> None:
        # Safe once brackets are escaped; kept intact for readable version strings.
        assert escape_markdown("(1)") == "(1)"
        assert escape_markdown("1.2.3") == "1.2.3"


class TestEscapeMarkdownCode:
    def test_empty_returns_default(self) -> None:
        assert escape_markdown_code(None) == ""
        assert escape_markdown_code("", default="--") == "--"

    def test_plain_text_unchanged(self) -> None:
        assert escape_markdown_code("com.example.app") == "com.example.app"

    def test_strips_backticks(self) -> None:
        # A backtick would close the surrounding code span early.
        assert escape_markdown_code("a`b`c") == "abc"

    def test_escapes_table_pipe(self) -> None:
        assert escape_markdown_code("a|b") == "a\\|b"

    def test_collapses_newlines(self) -> None:
        assert escape_markdown_code("a\nb") == "a b"

    def test_does_not_backslash_escape_other_specials(self) -> None:
        # Backslashes are literal inside a code span, so we must NOT add them.
        assert escape_markdown_code("a[b]c") == "a[b]c"
        assert escape_markdown_code("com.example.app") == "com.example.app"
