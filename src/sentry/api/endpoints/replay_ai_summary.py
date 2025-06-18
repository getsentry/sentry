from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.replay_summary import get_replay_summary
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ReplayAiSummaryEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.REPLAY

    # copied from GroupAiSummaryEndpoint
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=20, window=60),
            RateLimitCategory.USER: RateLimit(limit=20, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
        }
    }

    def post(
        self, request: Request, organization: Organization, project: Project, replay_id: str
    ) -> Response:
        data = orjson.loads(request.body) if request.body else {}

        # do we need this? modeled after force_event_id in GroupAiSummaryEndpoint
        force_replay_id = data.get("replay_id", None)

        summary_data, status_code = get_replay_summary(
            replay_id=replay_id,
            user=request.user,
            force_replay_id=force_replay_id,
            project=project,
            organization=organization,
        )

        return Response(summary_data, status=status_code)
