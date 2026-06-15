from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.sentry_apps.api.parsers.servicehook import ServiceHookValidator
from sentry.sentry_apps.api.serializers.servicehook import (
    ServiceHookSerializer,
    ServiceHookSerializerResponse,
)
from sentry.sentry_apps.models.servicehook import ServiceHook
from sentry.sentry_apps.services.hook import hook_service


@extend_schema(tags=["Integration"])
@cell_silo_endpoint
class ProjectServiceHooksEndpoint(ProjectEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def has_feature(self, request: Request, project):
        return features.has("projects:servicehooks", project=project, actor=request.user)

    @extend_schema(
        operation_id="List a Project's Service Hooks",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListServiceHooks", list[ServiceHookSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project) -> Response[list[ServiceHookSerializerResponse]]:
        """
        Return a list of service hooks bound to a project.

        This endpoint requires the `servicehooks` feature to be enabled for your project.
        """
        if not self.has_feature(request, project):
            return self.respond(
                {
                    "error_type": "unavailable_feature",
                    "detail": ["You do not have that feature enabled"],
                },
                status=403,
            )

        queryset = ServiceHook.objects.filter(project_id=project.id)
        status = request.GET.get("status")
        if status == "active":
            queryset = queryset.filter(status=ObjectStatus.ACTIVE)
        elif status == "disabled":
            queryset = queryset.filter(status=ObjectStatus.DISABLED)
        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            on_results=lambda x: serialize(x, request.user, ServiceHookSerializer()),
        )

    @extend_schema(
        operation_id="Register a New Service Hook",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=ServiceHookValidator,
        responses={
            201: inline_sentry_response_serializer("ServiceHook", ServiceHookSerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project) -> Response[ServiceHookSerializerResponse]:
        """
        Register a new service hook on a project.

        Events include:

        - `event.alert`: An alert is generated for an event (via rules).
        - `event.created`: A new event has been processed.

        This endpoint requires the `servicehooks` feature to be enabled for your project.
        """
        if not request.user.is_authenticated:
            return self.respond(status=401)

        if not self.has_feature(request, project):
            return self.respond(
                {
                    "error_type": "unavailable_feature",
                    "detail": ["You do not have that feature enabled"],
                },
                status=403,
            )

        validator = ServiceHookValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        result = validator.validated_data

        app_id: int | None = getattr(request.auth, "application_id", None)

        hook = hook_service.create_service_hook(
            project_ids=[project.id],
            organization_id=project.organization.id,
            url=result["url"],
            actor_id=request.user.id,
            events=result.get("events"),
            application_id=app_id,
            installation_id=None,  # Just being explicit here.
        )

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=hook.id,
            event=audit_log.get_event_id("SERVICEHOOK_ADD"),
            data=hook.get_audit_log_data(),
        )

        return self.respond(
            serialize(ServiceHook.objects.get(id=hook.id), request.user, ServiceHookSerializer()),
            status=201,
        )
