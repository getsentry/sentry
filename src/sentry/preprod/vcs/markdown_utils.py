from __future__ import annotations

import re

# Metacharacters that let untrusted text break out of a link or table cell, or
# inject raw HTML.
_MD_INLINE_SPECIAL = re.compile(r"([\\`\[\]<>&|])")
_NEWLINES = re.compile(r"[\r\n]+")


def escape_markdown(value: str | None, *, default: str = "") -> str:
    """Escape untrusted text for GitHub-flavored Markdown (links, table cells).

    Pass only untrusted artifact metadata; Sentry-generated content (URLs, i18n
    labels) must not be escaped. Returns ``default`` for empty input.
    """
    if not value:
        return default
    single_line = _NEWLINES.sub(" ", value)
    return _MD_INLINE_SPECIAL.sub(r"\\\1", single_line)


def escape_markdown_code(value: str | None, *, default: str = "") -> str:
    """Escape untrusted text placed inside an inline code span (`` `...` ``).

    Backslashes are literal inside code spans, so we strip backticks (which would
    close the span) and escape table-cell pipes. Returns ``default`` for empty input.
    """
    if not value:
        return default
    single_line = _NEWLINES.sub(" ", value)
    return single_line.replace("`", "").replace("|", "\\|")


def format_commit_sha_markdown(sha: str, *, repo_url: str | None = None) -> str:
    """Render a commit SHA as markdown, linking to the repo commit page when possible."""
    display = escape_markdown_code(sha)
    if not repo_url:
        return f"`{display}`"
    commit_url = f"{repo_url.rstrip('/')}/commit/{sha}"
    return f"[`{display}`]({commit_url})"
