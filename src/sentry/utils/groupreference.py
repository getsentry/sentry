from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING
from urllib.parse import urlparse

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)

_markdown_strip_re = re.compile(r"\[([^]]+)\]\([^)]+\)", re.I)

_fix_keywords = r"(?:Fix|Fixes|Fixed|Close|Closes|Closed|Resolve|Resolves|Resolved)"
_fix_keyword_re = re.compile(rf"\b{_fix_keywords}\b", re.I)

_fixes_re = re.compile(
    rf"\b{_fix_keywords}:?\s+([A-Za-z0-9_\-\s\,]+)\b",
    re.I,
)
_short_id_re = re.compile(r"\b([A-Z0-9_-]+-[A-Z0-9]+)\b", re.I)
_whitespace_re = re.compile(r"\s+")

# Matches fix keywords followed by a URL
_fixes_url_re = re.compile(
    rf"\b{_fix_keywords}:?\s+(https?://[^\s]+)",
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
        url_host = urlparse(url).netloc.lower()
        app_host = urlparse(options.get("system.url-prefix")).netloc.lower()
        if not url_host or not app_host:
            return False
        return url_host == app_host or url_host.endswith(f".{app_host}")
    except Exception:
        return False


def find_referenced_groups(text: str | None, org_id: int) -> set[Group]:
    from sentry.models.group import Group, GroupStatus

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
                # Intentionally org-scoped only (project_ids=None): this runs while processing
                # commit/PR text (see Commit/PullRequest.find_referenced_groups), which
                # legitimately links to any issue in the organization. There is no narrower
                # authorized-project set to enforce here.
                group = Group.objects.by_qualified_short_id(
                    organization_id=org_id, short_id=short_id, project_ids=None
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
        # Only match /issues/{id} in the path, not query params
        path = urlparse(url).path
        issue_match = _issue_url_re.search(path)
        if not issue_match:
            continue
        group_id = int(issue_match.group(1))
        # Skip IDs that would overflow PostgreSQL bigint
        if group_id > 9223372036854775807:
            continue
        try:
            group = Group.objects.exclude(
                status__in=[
                    GroupStatus.PENDING_DELETION,
                    GroupStatus.DELETION_IN_PROGRESS,
                    GroupStatus.PENDING_MERGE,
                ]
            ).get(id=group_id, project__organization_id=org_id)
        except Group.DoesNotExist:
            continue
        else:
            results.add(group)

    return results


def _count_narrative_chars(line: str) -> int:
    # Strip markdown links the same way find_referenced_groups does, so a
    # "Fixes [SENTRY-123](url)" line doesn't count its URL as narrative.
    remainder = _markdown_strip_re.sub(r"\1", line)
    remainder = _fix_keyword_re.sub("", remainder)
    remainder = _short_id_re.sub("", remainder)
    remainder = _whitespace_re.sub("", remainder)
    return len(remainder)


def find_fix_statements(text: str | None, org_id: int) -> list[tuple[str, set[Group]]]:
    if not text:
        return []

    statements = []
    for line in text.splitlines():
        groups = find_referenced_groups(line, org_id)
        if not groups:
            continue

        # check if the pr description contains extra chars
        narrative_chars = _count_narrative_chars(line)
        if narrative_chars:
            logger.warning(
                "groupreference.fix_statement_narrative_chars",
                extra={"organization_id": org_id, "narrative_chars": narrative_chars},
            )

        statements.append((line, groups))

    return statements
