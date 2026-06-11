from __future__ import annotations

import logging

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.builds_query import filtered_builds_queryset
from sentry.preprod.models import PreprodArtifact
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json
from sentry.web.frontend.csv import CsvResponder

logger = logging.getLogger(__name__)

# Maximum number of rows a single export may contain. Rather than silently
# truncating an oversized export (which would hand back a misleading partial CSV),
# we reject it and ask the user to narrow their query. The threshold mirrors the
# original Emerge implementation's MAX_NUM_ROWS. Streaming keeps memory flat, so
# this is a product/UX limit rather than a technical one.
CSV_EXPORT_ROW_LIMIT = 10_000

# Cells beginning with one of these characters can be interpreted as a formula by
# spreadsheet software, so we prefix them with a single quote to neutralize them.
_FORMULA_PREFIXES = ("=", "+", "-", "@")


def _escape_csv_value(value: object) -> str:
    """Stringify a value and neutralize spreadsheet formula injection."""
    if value is None:
        return ""
    text = str(value)
    if text and text[0] in _FORMULA_PREFIXES:
        return "'" + text
    return text


class BuildsCsvResponder(CsvResponder[PreprodArtifact]):
    def get_header(self) -> tuple[str, ...]:
        return (
            "app_name",
            "artifact_id",
            "app_id",
            "version",
            "platform",
            "install_groups",
            "upload_date",
            "download_count",
        )

    def get_row(self, item: PreprodArtifact) -> tuple[str, ...]:
        mobile_app_info = item.get_mobile_app_info()
        platform = item.platform
        # NOTE: download_count is the raw annotated sum across the artifact's
        # installable records. Unlike the /builds/ list endpoint it is NOT forced
        # to 0 for non-installable builds. Confirm desired semantics before GA.
        download_count = getattr(item, "download_count", 0)
        # install_groups is a free-form JSON list in extras; emit it as a JSON
        # array string so consumers can parse it back. csv.writer handles quoting
        # the embedded commas/quotes, and the leading "[" keeps the cell safe from
        # spreadsheet formula injection (so no _escape_csv_value needed here).
        raw_install_groups = (item.extras or {}).get("install_groups")
        install_groups = json.dumps(
            raw_install_groups if isinstance(raw_install_groups, list) else []
        )
        return (
            _escape_csv_value(mobile_app_info.app_name if mobile_app_info else None),
            _escape_csv_value(item.id),
            _escape_csv_value(item.app_id),
            _escape_csv_value(mobile_app_info.build_version if mobile_app_info else None),
            _escape_csv_value(platform.value if platform else None),
            install_groups,
            _escape_csv_value(item.date_added.isoformat() if item.date_added else None),
            _escape_csv_value(download_count),
        )


@cell_silo_endpoint
class BuildsExportEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=5, window=1, concurrent_limit=2),
                RateLimitCategory.USER: RateLimit(limit=5, window=1, concurrent_limit=2),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=1, concurrent_limit=5),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> HttpResponseBase:
        """Stream build distribution stats for the current filters as a CSV.

        Accepts the same ``query``, ``display``, ``project``, and date-range params as
        the builds list endpoint so the export matches what the user sees on screen.
        """
        filename = f"{organization.slug}-build-distribution"

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return BuildsCsvResponder().respond(iter(()), filename)

        query = request.GET.get("query", "").strip()
        display = request.GET.get("display")

        try:
            queryset = filtered_builds_queryset(
                organization=organization,
                query=query,
                display=display,
                project_ids=params["project_id"],
                start=params["start"],
                end=params["end"],
            )
        except InvalidSearchQuery as e:
            return Response({"detail": str(e)}, status=400)

        # Reject oversized exports instead of silently truncating, so the user never
        # gets a partial CSV that looks complete. Rate limiting (above) keeps this
        # count from being abused. We intentionally don't surface the actual total in
        # the error -- it would leak how many builds the org has.
        if queryset.count() > CSV_EXPORT_ROW_LIMIT:
            return Response(
                {
                    "detail": (
                        f"This export has too many builds to download at once (limit "
                        f"{CSV_EXPORT_ROW_LIMIT}). Narrow your search or date range and try again."
                    )
                },
                status=400,
            )

        # Only join what the CSV columns need; deliberately skip the heavy per-row
        # work the list endpoint does (base artifact, size metrics, snapshots, etc.).
        queryset = queryset.select_related("mobile_app_info").order_by("-date_added")

        return BuildsCsvResponder().respond(queryset.iterator(), filename)
