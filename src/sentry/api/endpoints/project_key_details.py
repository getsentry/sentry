from django.db.models import F
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project_key import ProjectKeySerializer
from sentry.api.serializers.rest_framework import ProjectKeyPutSerializer
from sentry.api.serializers.rest_framework.project_key import (
    DynamicSdkLoaderOptionSerializer,
    RateLimitSerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams, ProjectParams
from sentry.loader.browsersdkversion import get_default_sdk_version_for_project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectKeyDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Client Key",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.key_id("The ID of the client key"),
        ],
        request=None,
        responses={
            200: ProjectKeySerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.BASE_KEY,
    )
    def get(self, request: Request, project, key_id) -> Response:
        """
        Return a client key bound to a project.
        """
        try:
            key = ProjectKey.objects.get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(key, request.user), status=200)

    @extend_schema(
        operation_id="Update a Client Key",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.key_id("The ID of the key to update."),
        ],
        request=inline_serializer(
            name="UpdateClientKey",
            fields={
                "name": serializers.CharField(
                    help_text="The name for the client key", required=False
                ),
                "isActive": serializers.BooleanField(
                    help_text="Activate or deactivate the client key.", required=False
                ),
                "rateLimit": RateLimitSerializer(
                    required=False,
                ),
                "browserSdkVersion": serializers.ChoiceField(
                    help_text="The Sentry Javascript SDK version to use. The currently supported options are:",
                    # Ideally we would call get_browser_sdk_version_choices() here but that requires
                    # passing in project to this decorator
                    choices=[("latest", "Most recent version"), ("7.x", "Version 7 releases")],
                    required=False,
                ),
                "dynamicSdkLoaderOptions": DynamicSdkLoaderOptionSerializer(
                    required=False, partial=True
                ),
            },
        ),
        responses={
            200: ProjectKeySerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.BASE_KEY,
    )
    def put(self, request: Request, project, key_id) -> Response:
        """
        Update various settings for a client key.
        """
        try:
            key = ProjectKey.objects.get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ProjectKeyPutSerializer(data=request.data, partial=True)
        default_version = get_default_sdk_version_for_project(project)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        result = serializer.validated_data

        if result.get("name"):
            key.label = result["name"]
        if not key.data:
            key.data = {}
        key.data["browserSdkVersion"] = (
            default_version if not result.get("browserSdkVersion") else result["browserSdkVersion"]
        )

        result_dynamic_sdk_options = result.get("dynamicSdkLoaderOptions")
        if result_dynamic_sdk_options:
            if key.data.get("dynamicSdkLoaderOptions"):
                key.data["dynamicSdkLoaderOptions"].update(result_dynamic_sdk_options)
            else:
                key.data["dynamicSdkLoaderOptions"] = result_dynamic_sdk_options

        if result.get("isActive") is True:
            key.status = ProjectKeyStatus.ACTIVE
        elif result.get("isActive") is False:
            key.status = ProjectKeyStatus.INACTIVE

        if features.has("projects:rate-limits", project):
            ratelimit = result.get("rateLimit", -1)
            if (
                ratelimit is None
                or ratelimit != -1
                and ratelimit
                and (ratelimit["count"] is None or ratelimit["window"] is None)
            ):
                key.rate_limit_count = None
                key.rate_limit_window = None
            elif result.get("rateLimit"):
                key.rate_limit_count = result["rateLimit"]["count"]
                key.rate_limit_window = result["rateLimit"]["window"]

        key.save()

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=key.id,
            event=audit_log.get_event_id("PROJECTKEY_EDIT"),
            data=key.get_audit_log_data(),
        )

        return Response(serialize(key, request.user), status=200)

    @extend_schema(
        operation_id="Delete a Client Key",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_SLUG,
            ProjectParams.key_id("The ID of the key to delete."),
        ],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,
    )
    def delete(self, request: Request, project, key_id) -> Response:
        """
        Delete a client key for a given project.
        """
        try:
            key = ProjectKey.objects.get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=key.id,
            event=audit_log.get_event_id("PROJECTKEY_REMOVE"),
            data=key.get_audit_log_data(),
        )

        key.delete()

        return Response(status=204)
