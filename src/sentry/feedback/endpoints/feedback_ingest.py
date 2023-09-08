from __future__ import annotations

import datetime
from typing import Any, Dict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    ApiKeyAuthentication,
    DSNAuthentication,
    OrgAuthTokenAuthentication,
    TokenAuthentication,
)
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.feedback.models import Feedback
from sentry.models import Organization, ProjectKey
from sentry.models.project import Project
from sentry.utils.sdk import bind_organization_context, configure_scope


class FeedbackValidator(serializers.Serializer):
    contexts = serializers.JSONField(required=False)
    start_timestamp = serializers.FloatField(required=False)
    tags = serializers.JSONField(required=False)
    timestamp = serializers.FloatField(required=False)
    transaction = serializers.CharField(required=False)
    type = serializers.CharField(required=False)
    transaction_info = serializers.JSONField(required=False)
    platform = serializers.CharField(required=False)
    event_id = serializers.CharField(required=True)
    environment = serializers.CharField(required=False)
    release = serializers.CharField(required=False)
    sdk = serializers.JSONField(required=False)
    user = serializers.JSONField(required=False)
    request = serializers.JSONField(required=False)
    message = serializers.CharField(required=False)

    def validate(self, data):
        ret: Dict[str, Any] = {}
        ret["data"] = {
            "contexts": data["contexts"],
            "tags": data["tags"],
            "transaction": data["transaction"],
            "type": data["type"],
            "transaction_info": data["transaction_info"],
            "platform": data["platform"],
            "environment": data["environment"],
            "release": data["release"],
            "sdk": data["sdk"],
            "user": data["user"],
            "request": data["request"],
        }
        ret["date_added"] = datetime.datetime.fromtimestamp(data["timestamp"])
        ret["feedback_id"] = data["event_id"]
        ret["url"] = ""
        ret["project_id"] = self.context["project"].id
        ret["replay_id"] = ""
        ret["message"] = data["message"]

        return ret


class FeedbackIngestPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
        "POST": ["project:read", "project:write", "project:admin"],
        "PUT": ["project:read", "project:write", "project:admin"],
        "DELETE": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class FeedbackIngestEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    authentication_classes = (
        DSNAuthentication,
        TokenAuthentication,
        OrgAuthTokenAuthentication,
        ApiKeyAuthentication,
    )

    permission_classes = (FeedbackIngestPermission,)

    def convert_args(
        self,
        request: Request,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        using_dsn_auth = isinstance(request.auth, ProjectKey)

        # When using DSN auth we're able to infer the organization slug
        if not organization_slug and using_dsn_auth:
            organization_slug = request.auth.project.organization.slug  # type: ignore

        if organization_slug:
            try:
                organization = Organization.objects.get_from_cache(slug=organization_slug)
                # Try lookup by slug first. This requires organization context since
                # slugs are unique only to the organization
            except (Organization.DoesNotExist):
                pass

        project = request.auth.project  # type: ignore

        if project.status != ObjectStatus.ACTIVE:
            raise ResourceDoesNotExist

        if using_dsn_auth and project.id != request.auth.project_id:  # type: ignore
            raise ResourceDoesNotExist

        if organization_slug and project.organization.slug != organization_slug:
            raise ResourceDoesNotExist

        # Check project permission. Required for Token style authentication
        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        request._request.organization = project.organization  # type: ignore

        kwargs["organization"] = organization
        kwargs["project"] = project
        return args, kwargs

    def post(self, request: Request, organization: Organization, project: Project) -> Response:
        if not features.has(
            "organizations:user-feedback-ingest", project.organization, actor=request.user
        ):
            return Response(status=404)

        feedback_validator = FeedbackValidator(data=request.data, context={"project": project})
        if not feedback_validator.is_valid():
            return self.respond(feedback_validator.errors, status=400)

        result = feedback_validator.validated_data
        Feedback.objects.create(**result)
        return self.respond(status=201)
