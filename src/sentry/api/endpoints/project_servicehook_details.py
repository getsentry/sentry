from django.db import router, transaction
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.servicehook import ServiceHookEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.sentry_apps.api.parsers.servicehook import ServiceHookValidator
from sentry.sentry_apps.api.serializers.servicehook import (
    ServiceHookSerializer,
    ServiceHookSerializerResponse,
)
from sentry.sentry_apps.models.servicehook import ServiceHook

SERVICE_HOOK_EXAMPLE = {
    "dateCreated": "2018-11-06T21:20:08.143Z",
    "events": ["event.alert", "event.created"],
    "id": "4f9d73e63b7144ecb8944c41620a090b",
    "secret": "8fcac28aaa4c4f5fa572b61d40a8e084364db25fd37449c299e5a41c0504cbc2",
    "status": "active",
    "url": "https://empowerplant.io/sentry-hook",
}

SERVICE_HOOK_REQUEST_EXAMPLE = {
    "url": "https://empowerplant.io/sentry-hook",
    "events": ["event.alert", "event.created"],
}

SERVICE_HOOK_GUID = OpenApiParameter(
    name="hook_id",
    location="path",
    required=True,
    type=str,
    description="The GUID of the service hook.",
)


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class ProjectServiceHookDetailsEndpoint(ServiceHookEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve a Service Hook",
        description="Return a service hook bound to a project.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            SERVICE_HOOK_GUID,
        ],
        responses={
            200: inline_sentry_response_serializer("ServiceHook", ServiceHookSerializerResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Service hook",
                value=SERVICE_HOOK_EXAMPLE,
                response_only=True,
                status_codes=["200"],
            )
        ],
    )
    def get(
        self, request: Request, project: Project, hook: ServiceHook, **kwargs
    ) -> Response[ServiceHookSerializerResponse]:
        """
        Return a service hook bound to a project.
        """
        return self.respond(serialize(hook, request.user, ServiceHookSerializer()))

    @extend_schema(
        operation_id="Update a Service Hook",
        description="Update a service hook bound to a project.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            SERVICE_HOOK_GUID,
        ],
        request=ServiceHookValidator,
        responses={
            200: inline_sentry_response_serializer("ServiceHook", ServiceHookSerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Update a service hook",
                value=SERVICE_HOOK_REQUEST_EXAMPLE,
                request_only=True,
            ),
            OpenApiExample(
                "Updated service hook",
                value=SERVICE_HOOK_EXAMPLE,
                response_only=True,
                status_codes=["200"],
            ),
        ],
    )
    def put(
        self, request: Request, project: Project, hook: ServiceHook, **kwargs
    ) -> Response[ServiceHookSerializerResponse]:
        """
        Update a service hook bound to a project.
        """
        if not request.user.is_authenticated:
            return self.respond(status=401)

        validator = ServiceHookValidator(data=request.data, partial=True)
        if not validator.is_valid():
            return self.respond(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        result = validator.validated_data

        updates = {}
        if result.get("events") is not None:
            updates["events"] = result["events"]
        if result.get("url"):
            updates["url"] = result["url"]
        if result.get("version") is not None:
            updates["version"] = result["version"]
        if result.get("isActive") is True:
            updates["status"] = ObjectStatus.ACTIVE
        elif result.get("isActive") is False:
            updates["status"] = ObjectStatus.DISABLED

        with transaction.atomic(router.db_for_write(ServiceHook)):
            hook.update(**updates)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=hook.id,
                event=audit_log.get_event_id("SERVICEHOOK_EDIT"),
                data=hook.get_audit_log_data(),
            )

        return self.respond(serialize(hook, request.user, ServiceHookSerializer()))

    @extend_schema(
        operation_id="Remove a Service Hook",
        description="Remove a service hook from a project.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            SERVICE_HOOK_GUID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project, hook: ServiceHook, **kwargs) -> Response:
        """
        Remove a service hook from a project.
        """
        if not request.user.is_authenticated:
            return self.respond(status=401)

        with transaction.atomic(router.db_for_write(ServiceHook)):
            hook.delete()

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=hook.id,
                event=audit_log.get_event_id("SERVICEHOOK_REMOVE"),
                data=hook.get_audit_log_data(),
            )

        return self.respond(status=204)
