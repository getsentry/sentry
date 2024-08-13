from __future__ import annotations

import logging
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
from sentry.models.group import Group
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

from rest_framework.request import Request

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


class SummarizeIssueResponse(BaseModel):
    group_id: str
    summary: str
    impact: str


@region_silo_endpoint
class GroupAiSummaryEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    # go away
    private = True
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(
                limit=30, window=60
            ),  # TODO: Raise this limit when we move out of internal preview
        }
    }

    def _get_event(
        self, group: Group, user: AbstractBaseUser | AnonymousUser
    ) -> dict[str, Any] | None:
        event = group.get_recommended_event_for_environments()
        if not event:
            event = group.get_latest_event()

        if not event:
            return None

        event_id = event.event_id

        ready_event = eventstore.backend.get_event_by_id(
            group.project.id, event_id, group_id=group.id
        )

        if not ready_event:
            return None

        return serialize(ready_event, user, EventSerializer())

    def _call_seer(
        self,
        group: Group,
        serialized_event: dict[str, Any],
    ):
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
            },
            option=orjson.OPT_NON_STR_KEYS,
        )
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(
                    url=f"{settings.SEER_AUTOFIX_URL}{path}",
                    body=body,
                ),
            },
        )

        response.raise_for_status()

        return SummarizeIssueResponse.validate(response.json())

    def get(self, request: Request, group: Group) -> Response:
        if not features.has("organizations:ai-summary", group.organization, actor=request.user):
            return Response({"detail": "Feature flag not enabled"}, status=400)

        if group.data.get("issue_summary"):
            return Response(
                convert_dict_key_case(group.data["issue_summary"], snake_to_camel_case), status=200
            )

        serialized_event = self._get_event(group, request.user)

        if not serialized_event:
            return Response({"detail": "Could not find an event for the issue"}, status=400)

        issue_summary = self._call_seer(group, serialized_event)

        group.data.update({"issue_summary": issue_summary.dict()})
        group.save()

        return Response(
            convert_dict_key_case(issue_summary.dict(), snake_to_camel_case), status=200
        )
