from __future__ import annotations

import logging
from datetime import datetime

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User

logger = logging.getLogger(__name__)

from rest_framework.request import Request

TIMEOUT_SECONDS = 60 * 30  # 30 minutes


@region_silo_endpoint
class AIUnitTestGenerationEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=10, window=60),
            RateLimitCategory.USER: RateLimit(limit=10, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=60),
        }
    }

    def _respond_with_error(self, reason: str, status: int):
        return Response(
            {
                "detail": reason,
            },
            status=status,
        )

    def _call_unit_test_generation(
        self,
        user: User | AnonymousUser,
        owner: str | None,
        name: str | None,
        external_id: str | None,
        pr_id: int,
    ):
        path = "/v1/automation/codegen/unit-tests"
        body = orjson.dumps(
            {
                "repo": {
                    "provider": "github",
                    "owner": owner,
                    "name": name,
                    "external_id": external_id,
                },
                "pr_id": pr_id,
                "invoking_user": (
                    {
                        "id": user.id,
                        "display_name": user.get_display_name(),
                    }
                    if not isinstance(user, AnonymousUser)
                    else None
                ),
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

    def post(
        self,
        request: Request,
        *args,
        **kwargs,
    ) -> Response:
        owner = kwargs.get("organization").slug
        repo_name = kwargs.get("repo_name")
        pull_request_number = kwargs.get("pull_request_number")
        external_id = kwargs.get("external_id")
        created_at = datetime.now().isoformat()

        if pull_request_number is None:
            return self._respond_with_error("Missing pull request number.", 400)

        try:
            pr_id = int(pull_request_number)
        except ValueError:
            return self._respond_with_error("Invalid pull request number.", 400)

        try:
            self._call_unit_test_generation(
                request.user,
                owner=owner,
                name=repo_name,
                external_id=external_id,
                pr_id=pr_id,
            )
        except Exception as e:
            logger.exception(
                "Failed to send test generation request to seer",
                extra={
                    "created_at": created_at,
                    "exception": e,
                },
            )
            return self._respond_with_error(
                "Test generation failed to start.",
                500,
            )
        return Response(status=202)
