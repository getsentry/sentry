from __future__ import annotations

from typing import Any

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.models.code_review_event import CodeReviewEvent
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.search.utils import parse_datetime_string


@region_silo_endpoint
class OrganizationCodeReviewPRsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:pr-review-dashboard", organization, actor=request.user):
            return Response(status=404)

        queryset = CodeReviewEvent.objects.filter(organization_id=organization.id)

        repository_ids = request.GET.getlist("repositoryId")
        if repository_ids:
            queryset = queryset.filter(repository_id__in=repository_ids)

        trigger_type = request.GET.get("triggerType")
        if trigger_type:
            queryset = queryset.filter(trigger=trigger_type)

        start_str = request.GET.get("start")
        if start_str:
            queryset = queryset.filter(trigger_at__gte=parse_datetime_string(start_str))

        end_str = request.GET.get("end")
        if end_str:
            queryset = queryset.filter(trigger_at__lte=parse_datetime_string(end_str))

        pr_groups = (
            queryset.filter(pr_number__isnull=False)
            .values("repository_id", "pr_number")
            .annotate(
                event_count=Count("id"),
                total_comments=Coalesce(Sum("comments_posted"), 0),
                last_activity=Max("trigger_at"),
            )
            .order_by("-last_activity")
        )

        pr_state = request.GET.get("prState")

        return self.paginate(
            request=request,
            queryset=pr_groups,
            order_by="-last_activity",
            paginator_cls=OffsetPaginator,
            default_per_page=25,
            count_hits=True,
            on_results=lambda groups: self._enrich_groups(
                groups, queryset, organization.id, pr_state
            ),
        )

    def _enrich_groups(
        self,
        groups: list[dict[str, Any]],
        base_queryset: Any,
        organization_id: int,
        pr_state_filter: str | None = None,
    ) -> list[dict[str, Any]]:
        """Attach latest event metadata (title, author, status) to each PR group."""
        if not groups:
            return []

        repo_ids = {g["repository_id"] for g in groups}
        repos = {
            r.id: r
            for r in Repository.objects.filter(id__in=repo_ids, organization_id=organization_id)
        }

        # Build a single OR filter for all (repo_id, pr_number) pairs
        pr_filter = Q()
        for g in groups:
            pr_filter |= Q(repository_id=g["repository_id"], pr_number=g["pr_number"])

        # Fetch all candidate events in one query, ordered so the latest per PR comes first
        candidate_events = base_queryset.filter(pr_filter).order_by(
            "repository_id", "pr_number", "-trigger_at"
        )

        # Pick the latest event per (repo_id, pr_number)
        latest_events_by_key: dict[tuple[int, int], CodeReviewEvent] = {}
        for event in candidate_events:
            key = (event.repository_id, event.pr_number)
            if key not in latest_events_by_key:
                latest_events_by_key[key] = event

        results = []
        for group in groups:
            repo_id = group["repository_id"]
            pr_number = group["pr_number"]
            repo = repos.get(repo_id)
            latest_event = latest_events_by_key.get((repo_id, pr_number))

            # Filter by pr_state from the latest event rather than from all events,
            # since pr_state is denormalized and only the latest event reflects current state
            if pr_state_filter and (not latest_event or latest_event.pr_state != pr_state_filter):
                continue

            results.append(
                {
                    "repositoryId": str(repo_id),
                    "repositoryName": repo.name if repo else None,
                    "prNumber": pr_number,
                    "prTitle": latest_event.pr_title if latest_event else None,
                    "prAuthor": latest_event.pr_author if latest_event else None,
                    "prUrl": latest_event.pr_url if latest_event else None,
                    "prState": latest_event.pr_state if latest_event else None,
                    "latestStatus": latest_event.status if latest_event else None,
                    "latestTrigger": latest_event.trigger if latest_event else None,
                    "eventCount": group["event_count"],
                    "totalComments": group["total_comments"],
                    "lastActivity": group["last_activity"].isoformat()
                    if group["last_activity"]
                    else None,
                }
            )

        return results
