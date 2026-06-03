from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.tasks.summaries.utils import ONE_DAY
from sentry.tasks.summaries.weekly_report_cache import read_project_metrics
from sentry.utils.dates import floor_to_utc_day, to_datetime

SATURDAY_ISOWEEKDAY = 6

METRIC_KEY_MAP = {
    "e": "totalErrors",
    "t": "totalTransactions",
}


def _expand_metrics(abbreviated: dict[str, int] | None) -> dict[str, int] | None:
    if abbreviated is None:
        return None
    return {METRIC_KEY_MAP[k]: v for k, v in abbreviated.items() if k in METRIC_KEY_MAP}


def _compute_pct_change(
    current: dict[str, int] | None, previous: dict[str, int] | None
) -> dict[str, float | None] | None:
    if current is None or previous is None:
        return None
    change: dict[str, float | None] = {}
    for abbrev_key, camel_key in METRIC_KEY_MAP.items():
        cur = current.get(abbrev_key, 0)
        prev = previous.get(abbrev_key, 0)
        if prev == 0:
            change[camel_key] = None if cur > 0 else 0.0
        else:
            change[camel_key] = round(((cur - prev) / prev) * 100, 2)
    return change


@cell_silo_endpoint
class OrganizationWeeklyReportMetricsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.NOTIFICATIONS

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:weekly-report-metrics-api",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        today = floor_to_utc_day(timezone.now())
        days_since_saturday = (today.isoweekday() - SATURDAY_ISOWEEKDAY) % 7
        last_saturday = today - timedelta(days=days_since_saturday)
        current_timestamp = last_saturday.timestamp()
        previous_timestamp = current_timestamp - (ONE_DAY * 7)

        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]
        project_map = {p.id: p for p in projects}

        start_iso = to_datetime(current_timestamp - ONE_DAY * 7).isoformat()
        end_iso = to_datetime(current_timestamp).isoformat()

        if not project_ids:
            return Response(
                {
                    "start": start_iso,
                    "end": end_iso,
                    "dataAvailable": False,
                    "projects": [],
                }
            )

        metrics_by_project = read_project_metrics(
            org_id=organization.id,
            project_ids=project_ids,
            current_timestamp=current_timestamp,
            previous_timestamp=previous_timestamp,
        )

        if not metrics_by_project:
            return Response(
                {
                    "start": start_iso,
                    "end": end_iso,
                    "dataAvailable": False,
                    "projects": [],
                }
            )

        projects_response = []
        for project_id, data in metrics_by_project.items():
            project = project_map.get(project_id)
            if not project:
                continue
            current = data["current"]
            previous = data["previous"]
            projects_response.append(
                {
                    "id": str(project_id),
                    "slug": project.slug,
                    "currentWeek": _expand_metrics(current),
                    "previousWeek": _expand_metrics(previous),
                    "change": _compute_pct_change(current, previous),
                }
            )

        return Response(
            {
                "start": start_iso,
                "end": end_iso,
                "dataAvailable": True,
                "projects": projects_response,
            }
        )
