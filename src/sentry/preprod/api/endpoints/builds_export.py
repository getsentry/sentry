from __future__ import annotations

import logging

from django.http.response import HttpResponseBase
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.builds_query import filtered_builds_queryset
from sentry.preprod.models import PreprodArtifact
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json
from sentry.web.frontend.csv import CsvResponder

logger = logging.getLogger(__name__)

CSV_EXPORT_ROW_LIMIT = 10_000

_FORMULA_PREFIXES = ("=", "+", "-", "@")


def _escape_csv_value(value: object) -> str:
    """Stringify a value, neutralizing spreadsheet formula injection."""
    if value is None:
        return ""
    text = str(value)
    stripped = text.lstrip()
    if stripped and stripped[0] in _FORMULA_PREFIXES:
        return "'" + text
    return text


class BuildsCsvResponder(CsvResponder[PreprodArtifact]):
    def get_header(self) -> tuple[str, ...]:
        return (
            "app_name",
            "project_slug",
            "artifact_id",
            "app_id",
            "build_configuration",
            "version",
            "platform",
            "install_groups",
            "upload_date",
            "download_count",
        )

    def get_row(self, item: PreprodArtifact) -> tuple[str, ...]:
        mobile_app_info = item.get_mobile_app_info()
        platform = item.platform
        build_configuration = item.build_configuration
        download_count = getattr(item, "download_count", 0)

        # Emit install_groups as a JSON array
        raw_install_groups = (item.extras or {}).get("install_groups")
        install_groups = json.dumps(
            raw_install_groups if isinstance(raw_install_groups, list) else []
        )
        return (
            _escape_csv_value(mobile_app_info.app_name if mobile_app_info else None),
            _escape_csv_value(item.project.slug),
            _escape_csv_value(item.id),
            _escape_csv_value(item.app_id),
            _escape_csv_value(build_configuration.name if build_configuration else None),
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

        Accepts the same ``query``, ``project``, and date-range params as the builds list
        endpoint. The export is build-distribution-specific, so it always uses the
        distribution row set regardless of any ``display`` param.
        """
        filename = (
            f"{organization.slug}-build-distribution-{timezone.now().strftime('%Y-%m-%d-%H%M%S')}"
        )

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return BuildsCsvResponder().respond(iter(()), filename)

        query = request.GET.get("query", "").strip()

        # We force display="distribution" because the logic is really only for build distribution info.
        with handle_query_errors():
            queryset = filtered_builds_queryset(
                organization=organization,
                query=query,
                display="distribution",
                project_ids=params["project_id"],
                start=params["start"],
                end=params["end"],
            )

        # Filter out non-installable builds since they aren't really relevant for distribution info.
        queryset = queryset.filter(installable_app_file_id__isnull=False)

        # Reject oversized exports rather than silently truncating. The SQL limit is conservatively
        # correct, but could lead to false-negatives in some edge cases, which we're ignoring.
        row_count = queryset.count()
        if row_count > CSV_EXPORT_ROW_LIMIT:
            raise serializers.ValidationError(
                {
                    "detail": f"This export has {row_count} builds, which exceeds the limit of {CSV_EXPORT_ROW_LIMIT}. "
                    "Narrow your search or date range and try again."
                }
            )

        queryset = queryset.select_related(
            "mobile_app_info", "project", "build_configuration"
        ).order_by("-date_added")
        installable_builds = (
            artifact for artifact in queryset.iterator() if is_installable_artifact(artifact)
        )
        return BuildsCsvResponder().respond(installable_builds, filename)
