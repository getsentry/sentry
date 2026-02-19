from __future__ import annotations

from django.db.models import Avg, Count, F, Q, Sum
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.code_review_event import CodeReviewEvent, CodeReviewEventStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.code_review.api.serializers.code_review_event import CodeReviewEventSerializer


@region_silo_endpoint
class OrganizationCodeReviewPRDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, repo_id: str, pr_number: str
    ) -> Response:
        if not features.has("organizations:pr-review-dashboard", organization, actor=request.user):
            return Response(status=404)

        repo_id_int = int(repo_id)
        pr_number_int = int(pr_number)

        events = CodeReviewEvent.objects.filter(
            organization_id=organization.id,
            repository_id=repo_id_int,
            pr_number=pr_number_int,
        ).order_by("-trigger_at")

        if not events.exists():
            return Response(status=404)

        latest_event = events[0]

        try:
            repo = Repository.objects.get(id=repo_id_int, organization_id=organization.id)
            repo_name = repo.name
        except Repository.DoesNotExist:
            repo_name = None

        summary = events.aggregate(
            total_reviews=Count("id", filter=Q(status=CodeReviewEventStatus.REVIEW_COMPLETED)),
            total_failed=Count("id", filter=Q(status=CodeReviewEventStatus.REVIEW_FAILED)),
            total_skipped=Count(
                "id",
                filter=Q(
                    status__in=[
                        CodeReviewEventStatus.PREFLIGHT_DENIED,
                        CodeReviewEventStatus.WEBHOOK_FILTERED,
                    ]
                ),
            ),
            total_comments=Sum("comments_posted"),
            avg_review_duration=Avg(
                F("review_completed_at") - F("sent_to_seer_at"),
                filter=Q(
                    review_completed_at__isnull=False,
                    sent_to_seer_at__isnull=False,
                ),
            ),
        )

        avg_duration_ms = None
        if summary["avg_review_duration"] is not None:
            avg_duration_ms = int(summary["avg_review_duration"].total_seconds() * 1000)

        return Response(
            {
                "repositoryId": str(repo_id_int),
                "repositoryName": repo_name,
                "prNumber": pr_number_int,
                "prTitle": latest_event.pr_title,
                "prAuthor": latest_event.pr_author,
                "prUrl": latest_event.pr_url,
                "prState": latest_event.pr_state,
                "events": serialize(list(events), request.user, CodeReviewEventSerializer()),
                "summary": {
                    "totalReviews": summary["total_reviews"],
                    "totalFailed": summary["total_failed"],
                    "totalSkipped": summary["total_skipped"],
                    "totalComments": summary["total_comments"] or 0,
                    "avgReviewDurationMs": avg_duration_ms,
                },
            }
        )
