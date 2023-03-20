from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.validators import ServiceHookValidator
from sentry.models import ObjectStatus, ServiceHook
from sentry.services.hybrid_cloud.hook import hook_service


@region_silo_endpoint
class ProjectServiceHooksEndpoint(ProjectEndpoint):
    def has_feature(self, request: Request, project):
        return features.has("projects:servicehooks", project=project, actor=request.user)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Service Hooks
        ``````````````````````````````

        Return a list of service hooks bound to a project.

        This endpoint requires the 'servicehooks' feature to
        be enabled for your project.

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :auth: required
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
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, project) -> Response:
        """
        Register a new Service Hook
        ```````````````````````````

        Register a new service hook on a project.

        Events include:

        - event.alert: An alert is generated for an event (via rules).
        - event.created: A new event has been processed.

        This endpoint requires the 'servicehooks' feature to
        be enabled for your project.

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :param string url: the url for the webhook
        :param array[string] events: the events to subscribe to
        :auth: required
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

        with transaction.atomic():
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
            serialize(ServiceHook.objects.get(id=hook.id), request.user), status=201
        )
