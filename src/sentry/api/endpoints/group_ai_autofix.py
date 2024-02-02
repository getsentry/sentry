from __future__ import annotations

import logging
from datetime import datetime

import requests
from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.user import User
from sentry.tasks.ai_autofix import ai_autofix_check_for_timeout
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

from rest_framework.request import Request

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


@region_silo_endpoint
class GroupAiAutofixEndpoint(GroupEndpoint):
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
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        }
    }

    def _get_event_entries(self, group: Group, user: User) -> list | None:
        latest_event = group.get_latest_event()

        if not latest_event:
            return None

        serialized_event = serialize(latest_event, user, EventSerializer())
        return serialized_event["entries"]

    def _make_error_metadata(self, autofix: dict, reason: str):
        return {
            **autofix,
            "completed_at": datetime.now().isoformat(),
            "status": "ERROR",
            "fix": None,
            "error_message": reason,
            "steps": [],
        }

    def _respond_with_error(self, group: Group, metadata: dict, reason: str, status: int):
        metadata["autofix"] = self._make_error_metadata(metadata["autofix"], reason)

        group.data["metadata"] = metadata
        group.save()

        return Response(
            {
                "detail": reason,
            },
            status=status,
        )

    def _call_autofix(
        self,
        group: Group,
        base_commit_sha: str,
        event_entries: list[dict],
        additional_context: str,
    ):
        requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v0/automation/autofix",
            data=json.dumps(
                {
                    "base_commit_sha": base_commit_sha,
                    "issue": {
                        "id": group.id,
                        "title": group.title,
                        "events": [{"entries": event_entries}],
                    },
                    "additional_context": additional_context,
                }
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

    def post(self, request: Request, group: Group) -> Response:
        data = json.loads(request.body)

        created_at = datetime.now().isoformat()
        metadata = group.data.get("metadata", {})
        metadata["autofix"] = {
            "created_at": created_at,
            "status": "PROCESSING",
            "steps": [
                {
                    "id": "1",
                    "index": 1,
                    "title": "Waiting to be picked up...",
                    "status": "PROCESSING",
                }
            ],
        }

        if not request.user.is_authenticated:
            raise PermissionDenied(detail="You must be authenticated to perform this action.")

        event_entries = self._get_event_entries(group, request.user)

        if event_entries is None:
            return self._respond_with_error(
                group, metadata, "Cannot fix issues without an event.", 400
            )

        if not any([exception.get("type") == "exception" for exception in event_entries]):
            return self._respond_with_error(
                group, metadata, "Cannot fix issues without a stacktrace.", 400
            )

        release_version = group.get_last_release()
        if not release_version:
            return self._respond_with_error(group, metadata, "Event has no release.", 400)

        try:
            release: Release = Release.objects.get(
                organization_id=group.organization.id,
                projects=group.project,
                version=release_version,
            )
        except Release.DoesNotExist:
            return self._respond_with_error(
                group, metadata, "Release not found for the issue.", 400
            )
        release_commits: list[ReleaseCommit] = ReleaseCommit.objects.filter(release=release)

        commits: list[Commit] = [release_commit.commit for release_commit in release_commits]
        base_commit: Commit | None = None
        for commit in commits:
            repo: Repository = Repository.objects.get(id=commit.repository_id)
            provider = repo.get_provider()
            if provider:
                external_slug = provider.repository_external_slug(repo)
                # Hardcoded to only accept getsentry/sentry repo for now, when autofix on the seer side
                # supports more than just getsentry/sentry, we can remove this, and instead feature flag by project
                if external_slug == "getsentry/sentry":
                    base_commit = commit
                    break

        if not base_commit:
            return self._respond_with_error(
                group,
                metadata,
                "No valid base commit found for release; only getsentry/sentry repo is supported right now.",
                400,
            )

        try:
            self._call_autofix(
                group, base_commit.key, event_entries, data.get("additional_context", "")
            )

            # Mark the task as completed after TIMEOUT_SECONDS
            ai_autofix_check_for_timeout.apply_async(
                kwargs={
                    "group_id": group.id,
                    "created_at": created_at,
                },
                countdown=TIMEOUT_SECONDS,
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
                group,
                metadata,
                "Failed to send autofix to seer.",
                500,
            )

        group.data["metadata"] = metadata
        group.save()

        return Response(
            status=202,
        )

    def get(self, request: Request, group: Group) -> Response:
        metadata = group.data.get("metadata", {})
        autofix_data = metadata.get("autofix", None)

        return Response({"autofix": autofix_data})
