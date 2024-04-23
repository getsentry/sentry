from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import requests
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.helpers.repos import get_repos_from_project_code_mappings
from sentry.api.serializers import EventSerializer, serialize
from sentry.models.group import Group
from sentry.models.user import User
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

from rest_framework.request import Request

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


@region_silo_endpoint
class GroupAutofixEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    # go away
    private = True
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=5, window=1),
            RateLimitCategory.USER: RateLimit(limit=5, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
        }
    }

    def _get_serialized_event(
        self, event_id: int, group: Group, user: AbstractBaseUser | AnonymousUser
    ) -> dict[str, Any] | None:
        event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

        if not event:
            return None

        serialized_event = serialize(event, user, EventSerializer())
        return serialized_event

    def _make_error_metadata(self, autofix: dict, reason: str):
        return {
            **autofix,
            "completed_at": datetime.now().isoformat(),
            "status": "ERROR",
            "fix": None,
            "error_message": reason,
            "steps": [],
        }

    def _respond_with_error(self, reason: str, status: int):
        return Response(
            {
                "detail": reason,
            },
            status=status,
        )

    def _call_autofix(
        self,
        user: User | AnonymousUser,
        group: Group,
        repos: list[dict],
        serialized_event: dict[str, Any],
        instruction: str,
        timeout_secs: int,
    ):
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/start",
            data=json.dumps(
                {
                    "organization_id": group.organization.id,
                    "project_id": group.project.id,
                    "repos": repos,
                    "issue": {
                        "id": group.id,
                        "title": group.title,
                        "short_id": group.qualified_short_id,
                        "events": [serialized_event],
                    },
                    "instruction": instruction,
                    "timeout_secs": timeout_secs,
                    "last_updated": datetime.now().isoformat(),
                    "invoking_user": (
                        {
                            "id": user.id,
                            "display_name": user.get_display_name(),
                        }
                        if not isinstance(user, AnonymousUser)
                        else None
                    ),
                }
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

    def _call_get_autofix_state(self, group_id: int) -> dict[str, Any] | None:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/state",
            data=json.dumps(
                {
                    "group_id": group_id,
                }
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

        result = response.json()

        if result and result["group_id"] == group_id:
            return result["state"]

        return None

    def post(self, request: Request, group: Group) -> Response:
        data = json.loads(request.body)

        # This event_id is the event that the user is looking at when they click the "Fix" button
        event_id = data.get("event_id", None)
        if event_id is None:
            event = group.get_recommended_event_for_environments()
            if not event:
                event = group.get_latest_event()

            if not event:
                return Response(
                    {
                        "detail": "Could not find an event for the issue, please try providing an event_id"
                    },
                    status=400,
                )
            event_id = event.event_id

        created_at = datetime.now().isoformat()

        if not features.has("projects:ai-autofix", group.project):
            return self._respond_with_error("AI Autofix is not enabled for this project.", 403)

        # For now we only send the event that the user is looking at, in the near future we want to send multiple events.
        serialized_event = self._get_serialized_event(event_id, group, request.user)

        if serialized_event is None:
            return self._respond_with_error("Cannot fix issues without an event.", 400)

        if not any([entry.get("type") == "exception" for entry in serialized_event["entries"]]):
            return self._respond_with_error("Cannot fix issues without a stacktrace.", 400)

        repos = get_repos_from_project_code_mappings(group.project)

        if not repos:
            return self._respond_with_error(
                "Found no Github repositories linked to this project. Please set up the Github Integration and code mappings if you haven't",
                400,
            )

        try:
            self._call_autofix(
                request.user,
                group,
                repos,
                serialized_event,
                data.get("instruction", data.get("additional_context", "")),
                TIMEOUT_SECONDS,
            )
        except Exception as e:
            logger.exception(
                "Failed to send autofix to seer",
                extra={
                    "group_id": group.id,
                    "created_at": created_at,
                    "exception": e,
                },
            )

            return self._respond_with_error(
                "Failed to send autofix to seer.",
                500,
            )

        return Response(
            status=202,
        )

    def get(self, request: Request, group: Group) -> Response:
        autofix_state = self._call_get_autofix_state(group.id)

        return Response({"autofix": autofix_state})
