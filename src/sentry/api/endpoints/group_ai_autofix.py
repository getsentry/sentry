from __future__ import annotations

import logging
from datetime import datetime

from django.conf import settings
from django.http import HttpResponse

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url
from sentry.tasks.ai_autofix import check_for_timeout
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json

logger = logging.getLogger(__name__)

from rest_framework.request import Request

seer_connection_pool = connection_from_url(settings.AI_AUTOFIX_URL, retries=0)

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


@region_silo_endpoint
class GroupAiAutofixEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
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
        },
    }

    def post(self, request: Request, group: Group) -> HttpResponse:
        data = json.loads(request.body)
        latest_event = group.get_latest_event()
        if not latest_event:
            raise ResourceDoesNotExist

        created_at = datetime.now().isoformat()
        metadata = group.data.get("metadata", {})
        metadata["autofix"] = {
            "createdAt": created_at,
            "status": "PROCESSING",
        }

        event_stacktrace = {"entries": latest_event.data.get("exception", {}).get("values", [])}
        release_version = group.get_last_release()
        if not release_version:
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                "errorMessage": "Event has no release.",
            }

            group.data["metadata"] = metadata
            group.save()

            return HttpResponse(
                status=400,
            )

        release: Release = Release.objects.get(version=release_version)
        release_commits: list[ReleaseCommit] = ReleaseCommit.objects.filter(release=release)

        commits: list[Commit] = [release_commit.commit for release_commit in release_commits]
        base_commit: Commit | None = None
        for commit in commits:
            repo: Repository = Repository.objects.get(id=commit.repository_id)
            # Hardcoded to only accept getsentry/sentry repo for now
            if repo.external_id == "getsentry/sentry":
                base_commit = commit
                break

        if not base_commit:
            metadata["autofix"] = {
                **metadata["autofix"],
                "completedAt": datetime.now().isoformat(),
                "status": "ERROR",
                "fix": None,
                # Hardcoded to only accept getsentry/sentry repo for now
                "errorMessage": "No valid base commit found for release; only getsentry/sentry repo is supported right now.",
            }
            group.data["metadata"] = metadata
            group.save()

            return HttpResponse(
                status=400,
            )

        try:
            seer_connection_pool.urlopen(
                "POST",
                "/v0/automation/autofix",
                body=json.dumps(
                    {
                        "base_commit_sha": base_commit.key,
                        "issue": {
                            "id": str(group.id),
                            "title": group.title,
                            "events": [event_stacktrace],
                        },
                        "additional_context": data.get("additional_context", ""),
                    }
                ),
                headers={"content-type": "application/json;charset=utf-8"},
            )

            # Mark the task as completed after TIMEOUT_SECONDS
            check_for_timeout.apply_async(
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

        return HttpResponse(
            status=200,
        )
