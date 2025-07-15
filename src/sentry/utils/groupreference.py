from __future__ import annotations

import re
from typing import TYPE_CHECKING
from urllib.parse import urlparse

if TYPE_CHECKING:
    from sentry.models.group import Group

_markdown_strip_re = re.compile(r"\[([^]]+)\]\([^)]+\)", re.I)

_fixes_re = re.compile(
    r"\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved):?\s+([A-Za-z0-9_\-\s\,\:\/\.]+)\b",
    re.I,
)
_short_id_re = re.compile(r"\b([A-Z0-9_-]+-[A-Z0-9]+)\b", re.I)
_sentry_url_re = re.compile(r"https?://[^\s]+/issues/(\d+)", re.I)


def _is_sentry_url(url: str) -> bool:
    """
    Returns True if the given URL belongs to the current Sentry
    instance, based on the 'system.url-prefix' setting.
    """
    from sentry import options

    try:
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return False

        sentry_url = options.get("system.url-prefix")
        if not sentry_url:
            return False

        sentry_netloc = urlparse(sentry_url).netloc
        return parsed_url.netloc == sentry_netloc

    except ValueError:
        return False


def find_referenced_groups(text: str | None, org_id: int) -> set[Group]:
    from sentry.models.group import Group

    if not text:
        return set()

    # XXX(epurkhiser): Currently we only strip markdown links from our text. It
    # may make sense in the future to strip more, but we do offer users the
    # ability to copy and paste sentry issues as markdown, so we should at
    # least cover this case.
    text = _markdown_strip_re.sub(r"\1", text)

    results = set()
    for fmatch in _fixes_re.finditer(text):
        match_text = fmatch.group(1)

        # First try to find short IDs (e.g., "PROJECT-123")
        for smatch in _short_id_re.finditer(match_text):
            short_id = smatch.group(1)
            try:
                group = Group.objects.by_qualified_short_id(
                    organization_id=org_id, short_id=short_id
                )
            except Group.DoesNotExist:
                continue
            else:
                results.add(group)

        # Then try to find Sentry URLs (e.g., "https://sentry.io/issues/123")
        for umatch in _sentry_url_re.finditer(match_text):
            url = umatch.group(0)  # Full URL
            issue_id = umatch.group(1)  # Issue ID

            # Only process URLs that are likely Sentry URLs
            if not _is_sentry_url(url):
                continue
            try:
                group = Group.objects.get(id=issue_id, project__organization_id=org_id)
            except Group.DoesNotExist:
                continue
            else:
                results.add(group)
    return results
