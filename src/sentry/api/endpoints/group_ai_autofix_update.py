from __future__ import annotations

import logging

import requests
from django.conf import settings
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

from rest_framework.request import Request


@region_silo_endpoint
class GroupAiAutofixUpdateEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
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
        """
        Select a root cause for autofix

        :pparam int run_id: the ID of the run to select the root cause for
        :pparam int | None cause_id: the ID of the root cause to select
        :pparam int | None fix_id: the ID of the fix to select
        :pparam string | None custom_root_cause: the custom root cause to select
        """
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/update",
            data=request.body,
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

        return Response(
            status=202,
        )
