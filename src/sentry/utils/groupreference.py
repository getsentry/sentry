from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.group import Group

_markdown_strip_re = re.compile(r"\[([^]]+)\]\([^)]+\)", re.I)

_fixes_re = re.compile(
    r"\b(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved):?\s+([A-Za-z0-9_\-\s\,]+)\b",
    re.I,
)
_short_id_re = re.compile(r"\b([A-Z0-9_-]+-[A-Z0-9]+)\b", re.I)

# Match Sentry issue URLs in various formats:
# - https://sentry.io/organizations/{org}/issues/{id}/
# - https://{domain}/organizations/{org}/issues/{id}/
# - https://sentry.sentry.io/issues/{id}/
# The ID can be either a numeric ID or a qualified short ID like SENTRY-123
_sentry_url_re = re.compile(
    r"https?://[^/]+(?:/organizations/[^/]+)?/issues/([A-Z0-9_-]+(?:-[A-Z0-9]+)?|\d+)/?",
    re.I,
)


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
    
    # First, look for short IDs in "Fixes SENTRY-123" style references
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
    
    # Second, look for Sentry issue URLs in the entire text (not just after "Fixes")
    # This allows users to just paste the issue URL without keywords
    for url_match in _sentry_url_re.finditer(text):
        issue_id = url_match.group(1)
        
        # Try to determine if this is a short ID or numeric ID
        if "-" in issue_id:
            # This looks like a short ID (e.g., SENTRY-123)
            try:
                group = Group.objects.by_qualified_short_id(
                    organization_id=org_id, short_id=issue_id
                )
                results.add(group)
            except Group.DoesNotExist:
                continue
        else:
            # This is a numeric ID
            try:
                group = Group.objects.get(id=int(issue_id), organization_id=org_id)
                results.add(group)
            except (Group.DoesNotExist, ValueError):
                continue
    
    return results
