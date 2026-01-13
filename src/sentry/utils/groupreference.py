from __future__ import annotations

import re
from typing import TYPE_CHECKING
from urllib.parse import urlparse

if TYPE_CHECKING:
    from sentry.models.group import Group

_markdown_strip_re = re.compile(r"\[([^]]+)\]\([^)]+\)", re.I)

_fixes_re = re.compile(
    r"\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved):?\s+([A-Za-z0-9_\-\s\,]+)\b",
    re.I,
)
_short_id_re = re.compile(r"\b([A-Z0-9_-]+-[A-Z0-9]+)\b", re.I)

# Matches fix keywords followed by a URL
_fixes_url_re = re.compile(
    r"\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved):?\s+(https?://[^\s]+)",
    re.I,
)
# Extracts numeric group ID from /issues/{id} in URL path
_issue_url_re = re.compile(r"/issues/(\d+)")


def _is_valid_sentry_url(url: str) -> bool:
    """
    Check if a URL belongs to the configured Sentry instance.

    Validates that the URL's hostname ends with the configured system.url-prefix hostname,
    which handles main domains, customer domains (org.sentry.io), and regional domains.
    """
    from sentry import options

    try:
        url_host = urlparse(url).netloc
        app_host = urlparse(options.get("system.url-prefix")).netloc
        if not url_host or not app_host:
            return False
        return url_host == app_host or url_host.endswith(f".{app_host}")
    except Exception:
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

    # Match short IDs like "Fixes SENTRY-123"
    for fmatch in _fixes_re.finditer(text):
        for smatch in _short_id_re.finditer(fmatch.group(1)):
            short_id = smatch.group(1)
            try:
                group = Group.objects.by_qualified_short_id(
                    organization_id=org_id, short_id=short_id
                )
            except Group.DoesNotExist:
                continue
            else:
                results.add(group)

    # Match URLs like "Fixes https://sentry.io/issues/123456"
    for fmatch in _fixes_url_re.finditer(text):
        url = fmatch.group(1)
        if not _is_valid_sentry_url(url):
            continue
        issue_match = _issue_url_re.search(url)
        if not issue_match:
            continue
        group_id = int(issue_match.group(1))
        try:
            group = Group.objects.get(id=group_id, project__organization_id=org_id)
        except Group.DoesNotExist:
            continue
        else:
            results.add(group)

    return results
