from __future__ import annotations

import logging

import orjson
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)

logger = logging.getLogger(__name__)


@region_silo_endpoint
class GroupAutofixUpdateEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-autofix-update"])
    def post(self, request: Request, group: Group) -> Response:
        """
        Send an update event to autofix for a given group.
        """
        if not request.data:
            return Response(status=400, data={"error": "Need a body with a run_id and payload"})

        user = request.user
        if isinstance(user, AnonymousUser):
            return Response(
                status=401,
                data={"error": "You must be authenticated to use this endpoint"},
            )

        path = "/v1/automation/autofix/update"

        body = orjson.dumps(
            {
                **request.data,
                "invoking_user": (
                    {
                        "id": user.id,
                        "display_name": user.get_display_name(),
                    }
                ),
                "organization_id": group.organization.id,
            }
        )

        response = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            path,
            body,
        )

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        group.update(seer_autofix_last_triggered=timezone.now())

        return Response(status=202, data=response.json())
