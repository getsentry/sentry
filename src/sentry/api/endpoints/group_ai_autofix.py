from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings, get_autofix_state
from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.tasks.autofix import check_autofix_status
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
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
        self, event_id: str, group: Group, user: User | RpcUser | AnonymousUser
    ) -> tuple[dict[str, Any] | None, Event | GroupEvent | None]:
        event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

        if not event:
            return None, None

        serialized_event = serialize(event, user, EventSerializer())
        return serialized_event, event

    def _get_profile_for_event(
        self, event: Event | GroupEvent, project: Project
    ) -> dict[str, Any] | None:
        context = event.data.get("contexts", {})
        profile_id = context.get("profile", {}).get("profile_id")  # transaction profile

        profile_matches_event = True
        if not profile_id:
            # find most recent profile for this transaction instead
            profile_matches_event = False
            transaction_name = event.data.get("transaction", "")
            if not transaction_name:
                return {}

            event_filter = eventstore.Filter(
                project_ids=[project.id],
                conditions=[
                    ["transaction", "=", transaction_name],
                    ["profile.id", "IS NOT NULL", None],
                ],
            )
            results = eventstore.backend.get_events(
                filter=event_filter,
                referrer="api.group_ai_autofix",
                tenant_ids={"organization_id": project.organization_id},
                limit=1,
            )
            if results:
                context = results[0].data.get("contexts", {})
                profile_id = context.get("profile", {}).get("profile_id")

        if not profile_id:
            return None

        response = get_from_profiling_service(
            "GET",
            f"/organizations/{project.organization_id}/projects/{project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

        if response.status == 200:
            profile = orjson.loads(response.data)
            execution_tree = self._convert_profile_to_execution_tree(profile)
            result = {
                "profile_matches_issue": profile_matches_event,
                "execution_tree": execution_tree,
            }
            return result
        else:
            return None

    def _convert_profile_to_execution_tree(self, profile_data: dict) -> list[dict]:
        """
        Converts profile data into a hierarchical representation of code execution,
        including only items from the MainThread and app frames.
        """
        profile = profile_data["profile"]
        frames = profile["frames"]
        stacks = profile["stacks"]
        samples = profile["samples"]

        thread_metadata = profile.get("thread_metadata", {})
        main_thread_id = None
        for key, value in thread_metadata.items():
            if value["name"] == "MainThread":
                main_thread_id = key
                break

        def create_frame_node(frame_index: int) -> dict:
            """Create a node representation for a single frame"""
            frame = frames[frame_index]
            return {
                "function": frame.get("function", ""),
                "module": frame.get("module", ""),
                "filename": frame.get("filename", ""),
                "lineno": frame.get("lineno", 0),
                "in_app": frame.get("in_app", False),
                "children": [],
            }

        def find_or_create_child(parent: dict, frame_data: dict) -> dict:
            """Find existing child node or create new one"""
            for child in parent["children"]:
                if (
                    child["function"] == frame_data["function"]
                    and child["module"] == frame_data["module"]
                    and child["filename"] == frame_data["filename"]
                ):
                    return child

            parent["children"].append(frame_data)
            return frame_data

        def merge_stack_into_tree(tree: list[dict], stack_frames: list[dict]):
            """Merge a stack trace into the tree"""
            if not stack_frames:
                return

            # Find or create root node
            root = None
            for existing_root in tree:
                if (
                    existing_root["function"] == stack_frames[0]["function"]
                    and existing_root["module"] == stack_frames[0]["module"]
                    and existing_root["filename"] == stack_frames[0]["filename"]
                ):
                    root = existing_root
                    break

            if root is None:
                root = stack_frames[0]
                tree.append(root)

            # Merge remaining frames
            current = root
            for frame in stack_frames[1:]:
                current = find_or_create_child(current, frame)

        def process_stack(stack_index: int) -> list[dict]:
            """Process a stack and return its frame hierarchy, filtering out non-app frames"""
            frame_indices = stacks[stack_index]

            if not frame_indices:
                return []

            # Create nodes for app frames only, maintaining order
            nodes = []
            for idx in reversed(frame_indices):
                frame = frames[idx]
                if frame.get("in_app", False) and not (
                    frame.get("filename", "").startswith("<")
                    and frame.get("filename", "").endswith(">")
                ):
                    nodes.append(create_frame_node(idx))

            return nodes

        # Process all samples to build execution tree
        execution_tree: list[dict] = []

        for sample in samples:
            stack_id = sample["stack_id"]
            thread_id = sample["thread_id"]

            if str(thread_id) != str(main_thread_id):
                continue

            stack_frames = process_stack(stack_id)
            if stack_frames:
                merge_stack_into_tree(execution_tree, stack_frames)

        return execution_tree

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
        profile: dict[str, Any] | None,
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
                "profile": profile,
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
            event: Event | GroupEvent | None = group.get_recommended_event_for_environments()
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
        serialized_event, event = self._get_serialized_event(event_id, group, request.user)

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

        # find best profile for this event
        try:
            profile = self._get_profile_for_event(event, group.project) if event else None
        except Exception as e:
            logger.exception(
                "Failed to get profile for event",
                extra={
                    "group_id": group.id,
                    "created_at": created_at,
                    "exception": e,
                },
            )
            profile = None

        try:
            run_id = self._call_autofix(
                request.user,
                group,
                repos,
                serialized_event,
                profile,
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
