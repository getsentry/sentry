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

logger = logging.getLogger(__name__)

from rest_framework.request import Request


@region_silo_endpoint
class GroupAutofixUpdateEndpoint(GroupEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    def post(self, request: Request, group: Group) -> Response:
        """
        Send an update event to autofix for a given group.
        """
        if not request.data:
            return Response(status=400, data={"error": "Need a body with a run_id and payload"})

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/autofix/update",
            data=request.body,
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

        return Response(
            status=202,
        )
