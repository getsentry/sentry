from __future__ import annotations

from django.db.models import CharField, Count, Min, Q, Sum, Value
from django.db.models.functions import Cast, Coalesce, Concat, TruncDay, TruncHour
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.search.utils import parse_datetime_string

SKIPPED_STATUSES = Q(
    status__in=[CodeReviewEventStatus.PREFLIGHT_DENIED, CodeReviewEventStatus.WEBHOOK_FILTERED]
)
REVIEWED_STATUSES = Q(status=CodeReviewEventStatus.REVIEW_COMPLETED)


@region_silo_endpoint
class OrganizationCodeReviewStatsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:pr-review-dashboard", organization, actor=request.user):
            return Response(status=404)

        base_queryset = CodeReviewEvent.objects.filter(organization_id=organization.id)

        repo_ids = base_queryset.values_list("repository_id", flat=True).distinct()
        repos = Repository.objects.filter(id__in=repo_ids, organization_id=organization.id)
        repositories = [{"id": str(r.id), "name": r.name} for r in repos.order_by("name")]

        queryset = base_queryset

        repository_ids = request.GET.getlist("repositoryId")
        if repository_ids:
            queryset = queryset.filter(repository_id__in=repository_ids)

        pr_state = request.GET.get("prState")
        if pr_state:
            queryset = queryset.filter(pr_state=pr_state)

        start_str = request.GET.get("start")
        if start_str:
            queryset = queryset.filter(trigger_at__gte=parse_datetime_string(start_str))

        end_str = request.GET.get("end")
        if end_str:
            queryset = queryset.filter(trigger_at__lte=parse_datetime_string(end_str))

        # Event-level counts
        review_events = queryset.filter(REVIEWED_STATUSES)
        total_reviews = review_events.count()
        total_comments = review_events.aggregate(total=Coalesce(Sum("comments_posted"), 0))["total"]

        # PR-level stats: count distinct PRs and skipped PRs in SQL
        pr_stats = (
            queryset.filter(pr_number__isnull=False)
            .values("repository_id", "pr_number")
            .annotate(
                has_reviewed=Count("id", filter=REVIEWED_STATUSES),
                has_skipped=Count("id", filter=SKIPPED_STATUSES),
            )
        )
        total_prs = pr_stats.count()
        # A PR is "skipped" only if it has skipped events but was never reviewed
        skipped_prs = pr_stats.filter(has_skipped__gt=0, has_reviewed=0).count()

        # Author stats: distinct authors and top authors by PR count
        author_prs = (
            queryset.filter(pr_number__isnull=False, pr_author__isnull=False)
            .exclude(pr_author="")
            .values("pr_author")
            .annotate(
                pr_count=Count(
                    Concat(
                        Cast("repository_id", output_field=CharField()),
                        Value("-"),
                        Cast("pr_number", output_field=CharField()),
                    ),
                    distinct=True,
                )
            )
            .order_by("-pr_count")
        )
        total_authors = author_prs.count()
        top_authors = [
            {"author": entry["pr_author"], "prCount": entry["pr_count"]} for entry in author_prs[:3]
        ]

        interval = request.GET.get("interval", "1d")
        trunc_fn = TruncHour if interval == "1h" else TruncDay
        hourly = interval == "1h"

        # Event-level time series (reviewed/skipped/comments per bucket)
        time_series = (
            queryset.annotate(bucket=trunc_fn("trigger_at"))
            .values("bucket")
            .annotate(
                reviewed=Count("id", filter=REVIEWED_STATUSES),
                skipped=Count("id", filter=SKIPPED_STATUSES),
                comments=Coalesce(Sum("comments_posted", filter=REVIEWED_STATUSES), 0),
            )
            .order_by("bucket")
        )

        # PR-level: count each PR in the bucket of its first event, not every event's bucket
        pr_first_events = (
            queryset.filter(pr_number__isnull=False)
            .values("repository_id", "pr_number")
            .annotate(first_trigger=Min("trigger_at"))
        )
        prs_per_bucket: dict[str, int] = {}
        for pr in pr_first_events:
            ft = pr["first_trigger"]
            bucket = (
                ft.replace(minute=0, second=0, microsecond=0)
                if hourly
                else ft.replace(hour=0, minute=0, second=0, microsecond=0)
            )
            key = bucket.isoformat()
            prs_per_bucket[key] = prs_per_bucket.get(key, 0) + 1

        return Response(
            {
                "repositories": repositories,
                "stats": {
                    "totalPrs": total_prs,
                    "totalReviews": total_reviews,
                    "totalComments": total_comments,
                    "skippedPrs": skipped_prs,
                    "totalAuthors": total_authors,
                    "topAuthors": top_authors,
                },
                "timeSeries": [
                    {
                        "date": entry["bucket"].isoformat(),
                        "prs": prs_per_bucket.get(entry["bucket"].isoformat(), 0),
                        "reviewed": entry["reviewed"],
                        "skipped": entry["skipped"],
                        "comments": entry["comments"],
                    }
                    for entry in time_series
                ],
            }
        )
