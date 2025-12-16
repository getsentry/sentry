from __future__ import annotations

import logging

import orjson
import requests
from django.conf import settings
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.seer.models import PreferenceResponse, SeerProjectPreference
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class BranchOverrideSerializer(CamelSnakeSerializer):
    tag_name = serializers.CharField(required=True)
    tag_value = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=True)


class RepositorySerializer(CamelSnakeSerializer):
    organization_id = serializers.IntegerField(required=True)
    integration_id = serializers.CharField(required=True)
    provider = serializers.CharField(required=True)
    owner = serializers.CharField(required=True)
    name = serializers.CharField(required=True)
    external_id = serializers.CharField(required=True)
    branch_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    branch_overrides = BranchOverrideSerializer(
        many=True,
        required=False,
        allow_null=True,
    )
    instructions = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    base_commit_sha = serializers.CharField(required=False, allow_null=True)
    provider_raw = serializers.CharField(required=False, allow_null=True)


class SeerAutomationHandoffConfigurationSerializer(CamelSnakeSerializer):
    handoff_point = serializers.ChoiceField(
        choices=["root_cause"],
        required=True,
    )
    target = serializers.ChoiceField(
        choices=["cursor_background_agent"],
        required=True,
    )
    integration_id = serializers.IntegerField(required=True)
    auto_create_pr = serializers.BooleanField(required=False, default=False)


class ProjectSeerPreferencesSerializer(CamelSnakeSerializer):
    repositories = RepositorySerializer(many=True, required=True)
    automated_run_stopping_point = serializers.CharField(required=False, allow_null=True)
    automation_handoff = SeerAutomationHandoffConfigurationSerializer(
        required=False, allow_null=True
    )


@region_silo_endpoint
class ProjectSeerPreferencesEndpoint(ProjectEndpoint):
    permission_classes = (
        ProjectEventPermission,  # Anyone in the org should be able to set preferences, follows event permissions.
    )
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=20, window=60),
                RateLimitCategory.USER: RateLimit(limit=20, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=60, window=60),
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.USER: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=5000, window=60, concurrent_limit=1000
                ),
            },
            "OPTIONS": {
                RateLimitCategory.IP: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.USER: RateLimit(limit=1000, window=60, concurrent_limit=500),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=5000, window=60, concurrent_limit=1000
                ),
            },
        }
    )

    def post(self, request: Request, project: Project) -> Response:
        serializer = ProjectSeerPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        path = "/v1/project-preference/set"
        body = orjson.dumps(
            {
                "preference": SeerProjectPreference.validate(
                    {
                        # TODO: this should allow passing a partial preference object, upserting the rest.
                        **serializer.validated_data,
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

        return Response(status=204)

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

        code_mapping_repos = get_autofix_repos_from_project_code_mappings(project)

        return Response(
            PreferenceResponse.validate(
                {
                    **result,
                    "code_mapping_repos": code_mapping_repos,
                }
            ).dict()
        )
