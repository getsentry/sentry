from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from pydantic import BaseModel
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.constants import ObjectStatus
from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

from rest_framework.request import Request


class SummarizeIssueResponse(BaseModel):
    group_id: str
    headline: str
    whats_wrong: str | None = None
    trace: str | None = None
    possible_cause: str | None = None


@region_silo_endpoint
class GroupAiSummaryEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(
                limit=30, window=60
            ),  # TODO: Raise this limit when we move out of internal preview
        }
    }

    def _get_event(
        self, group: Group, user: AbstractBaseUser | AnonymousUser
    ) -> tuple[dict[str, Any] | None, GroupEvent | None]:
        event = group.get_recommended_event_for_environments()
        if not event:
            event = group.get_latest_event()

        if not event:
            return None, None

        event_id = event.event_id

        ready_event = eventstore.backend.get_event_by_id(
            group.project.id, event_id, group_id=group.id
        )

        if not ready_event:
            return None, None

        return serialize(ready_event, user, EventSerializer()), event

    def _call_seer(
        self,
        group: Group,
        serialized_event: dict[str, Any],
        connected_groups: list[Group],
        connected_serialized_events: list[dict[str, Any]],
    ):
        # limit amount of connected data we send to first few connected issues
        connected_groups = connected_groups[:4]
        connected_serialized_events = connected_serialized_events[:4]

        path = "/v1/automation/summarize/issue"
        body = orjson.dumps(
            {
                "group_id": group.id,
                "issue": {
                    "id": group.id,
                    "title": group.title,
                    "short_id": group.qualified_short_id,
                    "events": [serialized_event],
                },
                "connected_issues": [
                    {
                        "id": connected_groups[i].id,
                        "title": connected_groups[i].title,
                        "short_id": connected_groups[i].qualified_short_id,
                        "events": [connected_serialized_events[i]],
                    }
                    for i in range(len(connected_groups))
                ],
                "organization_slug": group.organization.slug,
                "organization_id": group.organization.id,
                "project_id": group.project.id,
            },
            option=orjson.OPT_NON_STR_KEYS,
        )

        url, salt = get_seer_salted_url(f"{settings.SEER_AUTOFIX_URL}{path}")
        response = requests.post(
            url,
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(
                    salt,
                    body=body,
                ),
            },
        )

        response.raise_for_status()

        return SummarizeIssueResponse.validate(response.json())

    def _get_trace_connected_issues(self, event: GroupEvent) -> list[Group]:
        trace_id = event.trace_id
        if not trace_id:
            return []
        organization = event.group.organization
        conditions = [["trace", "=", trace_id]]
        start = event.datetime - timedelta(days=1)
        end = event.datetime + timedelta(days=1)
        project_ids = list(
            dict(
                Project.objects.filter(
                    organization=organization, status=ObjectStatus.ACTIVE
                ).values_list("id", "slug")
            ).keys()
        )
        event_filter = eventstore.Filter(
            conditions=conditions, start=start, end=end, project_ids=project_ids
        )
        connected_events = eventstore.backend.get_events(
            filter=event_filter,
            referrer="api.group_ai_summary",
            tenant_ids={"organization_id": organization.id},
        )
        connected_events = sorted(
            connected_events, key=lambda event: event.datetime
        )  # sort chronologically

        issue_ids = set()
        connected_issues = []
        for e in connected_events:
            if event.event_id == e.event_id:
                continue
            if e.group_id not in issue_ids:
                issue_ids.add(e.group_id)
                if e.group:
                    connected_issues.append(e.group)
        return connected_issues

    def post(self, request: Request, group: Group) -> Response:
        if not features.has(
            "organizations:gen-ai-features", group.organization, actor=request.user
        ):
            return Response({"detail": "Feature flag not enabled"}, status=400)

        cache_key = "ai-group-summary-v2:" + str(group.id)
        if cached_summary := cache.get(cache_key):
            return Response(convert_dict_key_case(cached_summary, snake_to_camel_case), status=200)

        serialized_event, event = self._get_event(group, request.user)

        if not serialized_event or not event:
            return Response({"detail": "Could not find an event for the issue"}, status=400)

        # get trace connected issues
        connected_issues = self._get_trace_connected_issues(event)

        # get recommended event for each connected issue
        serialized_events_for_connected_issues = []
        for issue in connected_issues:
            serialized_connected_event, _ = self._get_event(issue, request.user)
            if serialized_connected_event:
                serialized_events_for_connected_issues.append(serialized_connected_event)

        issue_summary = self._call_seer(
            group, serialized_event, connected_issues, serialized_events_for_connected_issues
        )

        cache.set(cache_key, issue_summary.dict(), timeout=int(timedelta(days=7).total_seconds()))

        return Response(
            convert_dict_key_case(issue_summary.dict(), snake_to_camel_case), status=200
        )
