from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings, get_autofix_state
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.models.group import Group
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.tasks.autofix import check_autofix_status
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service

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
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=60),
        }
    }

    def _get_serialized_event(
        self, event_id: str, group: Group, user: AbstractBaseUser | AnonymousUser
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
        pr_to_comment_on_url: str | None = None,
    ):
        path = "/v1/automation/autofix/start"
        body = orjson.dumps(
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
                "options": {
                    "comment_on_pr_with_url": pr_to_comment_on_url,
                },
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

        return response.json().get("run_id")

    def post(self, request: Request, group: Group) -> Response:
        data = orjson.loads(request.body)

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

        if not (
            features.has("organizations:gen-ai-features", group.organization, actor=request.user)
            and group.organization.get_option("sentry:gen_ai_consent_v2024_11_14", False)
        ):
            return self._respond_with_error("AI Autofix is not enabled for this project.", 403)

        # For now we only send the event that the user is looking at, in the near future we want to send multiple events.
        serialized_event = self._get_serialized_event(event_id, group, request.user)

        if serialized_event is None:
            return self._respond_with_error("Cannot fix issues without an event.", 400)

        if not any([entry.get("type") == "exception" for entry in serialized_event["entries"]]):
            return self._respond_with_error("Cannot fix issues without a stacktrace.", 400)

        repos = get_autofix_repos_from_project_code_mappings(group.project)

        if not repos:
            return self._respond_with_error(
                "Found no Github repositories linked to this project. Please set up the Github Integration and code mappings if you haven't",
                400,
            )

        try:
            run_id = self._call_autofix(
                request.user,
                group,
                repos,
                serialized_event,
                data.get("instruction", data.get("additional_context", "")),
                TIMEOUT_SECONDS,
                data.get("pr_to_comment_on_url", None),  # support optional PR id for copilot
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
                "Autofix failed to start.",
                500,
            )

        check_autofix_status.apply_async(args=[run_id], countdown=timedelta(minutes=15).seconds)

        return Response(
            status=202,
        )

    def get(self, request: Request, group: Group) -> Response:
        autofix_state = get_autofix_state(group_id=group.id)

        response_state: dict[str, Any] | None = None

        if autofix_state:
            response_state = autofix_state.dict()
            user_ids = autofix_state.actor_ids
            if user_ids:
                users = user_service.serialize_many(
                    filter={"user_ids": user_ids, "organization_id": request.organization.id},
                    as_user=request.user,
                )

                users_map = {user["id"]: user for user in users}

                response_state["users"] = users_map

            project = group.project
            repositories = []
            if project:
                code_mappings = get_sorted_code_mapping_configs(project=project)
                for mapping in code_mappings:
                    repo = mapping.repository
                    repositories.append(
                        {
                            "url": repo.url,
                            "external_id": repo.external_id,
                            "name": repo.name,
                            "provider": repo.provider,
                            "default_branch": mapping.default_branch,
                        }
                    )
            response_state["repositories"] = repositories

        return Response({"autofix": response_state})
