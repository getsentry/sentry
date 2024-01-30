from __future__ import annotations

import logging
from datetime import datetime

import requests
from django.conf import settings
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
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

    def post(self, request: Request, group: Group) -> Response:
        data = json.loads(request.body)
        latest_event = group.get_latest_event()
        if not latest_event:
            return Response(
                {
                    "detail": "No event found.",
                },
                status=400,
            )

        created_at = datetime.now().isoformat()
        metadata = group.data.get("metadata", {})
        metadata["autofix"] = {
            "createdAt": created_at,
            "status": "PROCESSING",
        }

        event_stacktrace = {"entries": latest_event.data.get("exception", {}).get("values", [])}
        release_version = group.get_last_release()
        if not release_version:
            reason = "Event has no release."
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                "errorMessage": reason,
            }

            group.data["metadata"] = metadata
            group.save()

            return Response(
                {
                    "detail": reason,
                },
                status=400,
            )

        try:
            release: Release = Release.objects.get(
                organization_id=group.organization.id,
                projects=group.project,
                version=release_version,
            )
        except Release.DoesNotExist:
            reason = "Release does not exist."
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                "errorMessage": reason,
            }

            group.data["metadata"] = metadata
            group.save()

            return Response(
                {
                    "detail": reason,
                },
                status=500,
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
            reason = "No valid base commit found for release; only getsentry/sentry repo is supported right now."
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                # Hardcoded to only accept getsentry/sentry repo for now
                "errorMessage": reason,
            }
            group.data["metadata"] = metadata
            group.save()

            return Response(
                {
                    "detail": reason,
                },
                status=400,
            )

        try:
            requests.post(
                f"{settings.SEER_AUTOFIX_URL}/v0/automation/autofix",
                json={
                    "base_commit_sha": base_commit.key,
                    "issue": {
                        "id": group.id,
                        "title": group.title,
                        "events": [event_stacktrace],
                    },
                    "additional_context": data.get("additional_context", ""),
                },
                headers={"content-type": "application/json;charset=utf-8"},
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
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                "errorMessage": "Failed to send autofix to seer.",
            }

            logger.exception(
                "Failed to send autofix to seer",
                extra={
                    "group_id": group.id,
                    "created_at": created_at,
                    "exception": e,
                },
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
