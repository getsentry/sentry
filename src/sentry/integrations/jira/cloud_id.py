"""
Look up each Jira Cloud site's cloudId from its stored base URL.

Forge identifies a site by its cloudId, but Jira integrations are keyed by the
Connect clientKey. Before rekeying them, run ``audit_cloud_ids`` from a control
silo shell to find integrations that would collide on one cloudId and sites
that no longer resolve. It only reads; nothing is written to the database.

    >>> from sentry.integrations.jira.cloud_id import audit_cloud_ids
    >>> audit = audit_cloud_ids(limit=100)
    >>> print(audit.summary())
    >>> audit.write_csv("/tmp/jira_cloud_ids.csv")
"""

from __future__ import annotations

import csv
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from enum import StrEnum
from urllib.parse import urlparse

import requests

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)

# The endpoint returns the cloudId without authentication.
TENANT_INFO_PATH = "/_edge/tenant_info"
ATLASSIAN_SITE_SUFFIXES = (".atlassian.net", ".jira.com")


class CloudIdStatus(StrEnum):
    FOUND = "found"
    # The site answered but has no cloudId (deleted or inactive site).
    NOT_FOUND = "not_found"
    # Not an Atlassian Cloud URL, so it was never requested.
    UNEXPECTED_HOST = "unexpected_host"
    # Timeout, 5xx or similar. Worth retrying before deciding anything.
    ERROR = "error"


@dataclass(frozen=True)
class CloudIdLookup:
    status: CloudIdStatus
    cloud_id: str | None = None
    detail: str = ""
    # Set when the stored base URL redirects to a renamed site.
    moved_to: str | None = None


@dataclass(frozen=True)
class CloudIdResult:
    integration_id: int
    integration_status: int
    base_url: str
    lookup: CloudIdLookup


def _is_atlassian_site(host: str) -> bool:
    return host.endswith(ATLASSIAN_SITE_SUFFIXES)


def fetch_cloud_id(base_url: str, timeout: int = 10) -> CloudIdLookup:
    parsed = urlparse(base_url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not _is_atlassian_site(host):
        return CloudIdLookup(CloudIdStatus.UNEXPECTED_HOST)

    try:
        # Renamed sites redirect to their new hostname.
        response = safe_urlopen(
            f"https://{host}{TENANT_INFO_PATH}", allow_redirects=True, timeout=timeout
        )
    except (requests.RequestException, RestrictedIPAddress) as e:
        return CloudIdLookup(CloudIdStatus.ERROR, detail=type(e).__name__)

    if response.status_code == 404:
        return CloudIdLookup(CloudIdStatus.NOT_FOUND, detail="404")
    if response.status_code != 200:
        return CloudIdLookup(CloudIdStatus.ERROR, detail=str(response.status_code))

    try:
        cloud_id = response.json().get("cloudId")
    except (ValueError, AttributeError):
        cloud_id = None
    if not isinstance(cloud_id, str) or not cloud_id:
        return CloudIdLookup(CloudIdStatus.NOT_FOUND, detail="no cloudId in response")

    final_host = urlparse(response.url).hostname or ""
    if not _is_atlassian_site(final_host):
        return CloudIdLookup(CloudIdStatus.UNEXPECTED_HOST, detail=f"redirected to {final_host}")
    moved_to = final_host if final_host != host else None
    return CloudIdLookup(CloudIdStatus.FOUND, cloud_id=cloud_id, moved_to=moved_to)


@dataclass(frozen=True)
class CloudIdAudit:
    results: list[CloudIdResult]

    def duplicates(self) -> dict[str, list[int]]:
        """cloudIds shared by more than one integration. These would collide on
        unique_together(provider, external_id) after rekeying."""
        by_cloud_id: defaultdict[str, list[int]] = defaultdict(list)
        for result in self.results:
            if result.lookup.cloud_id:
                by_cloud_id[result.lookup.cloud_id].append(result.integration_id)
        return {cloud_id: ids for cloud_id, ids in by_cloud_id.items() if len(ids) > 1}

    def summary(self) -> str:
        statuses = Counter(result.lookup.status for result in self.results)
        details = Counter(
            (result.lookup.status, result.lookup.detail)
            for result in self.results
            if result.lookup.detail
        )
        moved = sum(1 for result in self.results if result.lookup.moved_to)
        duplicates = self.duplicates()

        lines = [f"integrations checked: {len(self.results)}"]
        lines += [f"  {status}: {statuses[status]}" for status in CloudIdStatus]
        lines.append(f"  found, base_url redirects elsewhere: {moved}")
        lines += [f"  {status} ({detail}): {count}" for (status, detail), count in details.items()]
        lines.append(f"cloudIds shared by more than one integration: {len(duplicates)}")
        lines += [f"  {cloud_id}: {ids}" for cloud_id, ids in duplicates.items()]
        return "\n".join(lines)

    def write_csv(self, path: str) -> None:
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "integration_id",
                    "integration_status",
                    "base_url",
                    "status",
                    "cloud_id",
                    "detail",
                    "moved_to",
                ]
            )
            for result in self.results:
                writer.writerow(
                    [
                        result.integration_id,
                        result.integration_status,
                        result.base_url,
                        result.lookup.status,
                        result.lookup.cloud_id or "",
                        result.lookup.detail,
                        result.lookup.moved_to or "",
                    ]
                )


def audit_cloud_ids(
    *, limit: int | None = None, min_id: int | None = None, max_workers: int = 16
) -> CloudIdAudit:
    # Every status is included: disabled rows still hold their external_id, so
    # they can collide too.
    integrations = [
        (integration.id, integration.status, integration.metadata.get("base_url", ""))
        for integration in RangeQuerySetWrapper(
            Integration.objects.filter(provider=IntegrationProviderSlug.JIRA.value),
            limit=limit,
            min_id=min_id,
        )
    ]

    def check(row: tuple[int, int, str]) -> CloudIdResult:
        integration_id, integration_status, base_url = row
        try:
            lookup = fetch_cloud_id(base_url)
        except Exception as e:
            # One malformed row shouldn't throw away a long run's results.
            lookup = CloudIdLookup(CloudIdStatus.ERROR, detail=type(e).__name__)
        return CloudIdResult(integration_id, integration_status, base_url, lookup)

    results: list[CloudIdResult] = []
    with ContextPropagatingThreadPoolExecutor(max_workers=max_workers) as pool:
        for result in pool.map(check, integrations):
            results.append(result)
            if len(results) % 1000 == 0:
                logger.info(
                    "jira.cloud_id_audit.progress",
                    extra={"checked": len(results), "total": len(integrations)},
                )
    return CloudIdAudit(results)
