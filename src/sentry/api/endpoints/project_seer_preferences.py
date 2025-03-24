from __future__ import annotations

import logging

import orjson
import requests
from django.conf import settings
from pydantic import BaseModel
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.seer.models import SeerRepoDefinition
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class SeerProjectPreference(BaseModel):
    organization_id: int
    project_id: int
    repositories: list[SeerRepoDefinition]


class PreferenceResponse(BaseModel):
    preference: SeerProjectPreference | None


@region_silo_endpoint
class ProjectSeerPreferencesEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=20, window=60),
            RateLimitCategory.USER: RateLimit(limit=20, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60),
        }
    }

    def post(self, request: Request, project: Project) -> Response:
        data = orjson.loads(request.body)

        path = "/v1/project-preference/set"
        body = orjson.dumps(
            {
                "preference": SeerProjectPreference.validate(
                    {
                        **data,
                        "organization_id": project.organization.id,
                        "project_id": project.id,
                    }
                ).dict(),
            }
        )

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()

        result = response.json()

        return Response(PreferenceResponse.validate(result).dict())

    def get(self, request: Request, project: Project) -> Response:
        path = "/v1/project-preference"
        body = orjson.dumps(
            {
                "project_id": project.id,
            }
        )

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()

        result = response.json()

        return Response(PreferenceResponse.validate(result).dict())
