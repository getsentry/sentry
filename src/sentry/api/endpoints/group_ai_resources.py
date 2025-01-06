from datetime import timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from pydantic import BaseModel
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.cache import cache


class Citation(BaseModel):
    url: str
    title: str


class Resource(BaseModel):
    text: str
    citations: list[Citation]


class FindIssueResourcesResponse(BaseModel):
    group_id: int
    text: str
    resources: list[Resource]


@region_silo_endpoint
class GroupAiResourceEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=60),
        }
    }

    def _get_event(
        self,
        group: Group,
        user: AbstractBaseUser | AnonymousUser,
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
    ):
        path = "/v1/automation/resources/issue"
        body = orjson.dumps(
            {
                "group_id": group.id,
                "issue": {
                    "id": group.id,
                    "title": group.title,
                    "short_id": group.qualified_short_id,
                    "events": [serialized_event],
                },
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

        return FindIssueResourcesResponse.validate(response.json())

    def post(self, request: Request, group: Group) -> Response:
        if not features.has(
            "organizations:gen-ai-features", group.organization, actor=request.user
        ):
            return requests.Response({"detail": "Feature flag not enabled"}, status=400)

        cache_key = "ai-group-resources:" + str(group.id)
        if cached_summary := cache.get(cache_key):
            return Response(convert_dict_key_case(cached_summary, snake_to_camel_case), status=200)

        serialized_event, event = self._get_event(group, request.user)

        if not serialized_event or not event:
            return Response({"detail": "Could not find an event for the issue"}, status=400)

        issue_summary = self._call_seer(group, serialized_event)
        summary_dict = issue_summary.dict()
        summary_dict["event_id"] = event.event_id

        cache.set(cache_key, summary_dict, timeout=int(timedelta(days=7).total_seconds()))

        return Response(convert_dict_key_case(summary_dict, snake_to_camel_case), status=200)
