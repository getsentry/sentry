from __future__ import annotations

import datetime
from typing import Any, Dict
from uuid import uuid4

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
    UserAuthTokenAuthentication,
)
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.feedback.models import Feedback
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.utils.sdk import bind_organization_context, configure_scope


class FeedbackValidator(serializers.Serializer):
    # required fields
    feedback = serializers.JSONField(required=True)
    platform = serializers.CharField(required=True)
    sdk = serializers.JSONField(required=True)
    timestamp = serializers.FloatField(required=True)

    # optional fields
    release = serializers.CharField(required=False)
    environment = serializers.CharField(required=False, allow_null=True, default="production")
    dist = serializers.CharField(required=False)
    event_id = serializers.CharField(required=False)
    request = serializers.JSONField(required=False)
    tags = serializers.JSONField(required=False)
    user = serializers.JSONField(required=False)
    contexts = serializers.JSONField(required=False)
    BrowserContext = serializers.JSONField(required=False)
    DeviceContext = serializers.JSONField(required=False)

    def validate_environment(self, value):
        if not Environment.is_valid_name(value):
            raise serializers.ValidationError("Invalid value for environment")
        return value

    def validate(self, data):
        try:
            ret: Dict[str, Any] = {}
            ret["data"] = {
                "feedback": data["feedback"],
                "platform": data["platform"],
                "sdk": data["sdk"],
                "release": data.get("release"),
                "request": data.get("request"),
                "user": data.get("user"),
                "tags": data.get("tags"),
                "dist": data.get("dist"),
                "contexts": data.get("contexts"),
                "browser": data.get("BrowserContext"),
                "device": data.get("DeviceContext"),
            }
            ret["date_added"] = datetime.datetime.fromtimestamp(data["timestamp"])
            ret["feedback_id"] = data.get("event_id") or uuid4().hex
            ret["url"] = data["feedback"]["url"]
            ret["message"] = data["feedback"]["message"]
            ret["replay_id"] = data["feedback"].get("replay_id")
            ret["project_id"] = self.context["project"].id
            ret["organization_id"] = self.context["organization"].id
            ret["environment"] = data.get("environment")
            return ret
        except KeyError:
            raise serializers.ValidationError("Input has wrong field name or type")


class FeedbackIngestPermission(ProjectPermission):
    scope_map = {
        "POST": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class FeedbackIngestEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.FEEDBACK

    # Authentication code borrowed from the monitor endpoints (which will eventually be removed)
    authentication_classes = (
        DSNAuthentication,
        UserAuthTokenAuthentication,
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
            except Organization.DoesNotExist:
                raise ResourceDoesNotExist

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

        feedback_validator = FeedbackValidator(
            data=request.data, context={"project": project, "organization": organization}
        )
        if not feedback_validator.is_valid():
            return self.respond(feedback_validator.errors, status=400)

        result = feedback_validator.validated_data

        env = Environment.objects.get_or_create(
            name=result["environment"], organization_id=organization.id
        )[0]
        result["environment"] = env

        # FOR NOW CREATE BOTH A FEEDBACK ISSUE AND A FEEDBACK OBJECT
        # WE MAY NOT END UP NEEDING A FEEDBACK OBJECT, BUT IT'S HERE FOR NOW
        Feedback.objects.create(**result)

        _convert_feedback_to_context(request.data)
        create_feedback_issue(
            request.data, project.id, FeedbackCreationSource.NEW_FEEDBACK_DJANGO_ENDPOINT
        )

        return self.respond(status=201)


def _convert_feedback_to_context(event):
    if event.get("feedback"):
        if "contexts" not in event:
            event["contexts"] = {}
        event["contexts"]["feedback"] = event["feedback"]
        del event["feedback"]
