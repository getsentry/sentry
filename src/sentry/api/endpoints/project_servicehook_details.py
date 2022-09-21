from django.db import transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.validators import ServiceHookValidator
from sentry.constants import ObjectStatus
from sentry.models import ServiceHook


@region_silo_endpoint
class ProjectServiceHookDetailsEndpoint(ProjectEndpoint):
    def get(self, request: Request, project, hook_id) -> Response:
        """
        Retrieve a Service Hook
        ```````````````````````

        Return a service hook bound to a project.

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :pparam string hook_id: the guid of the service hook.
        :auth: required
        """
        try:
            hook = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist
        return self.respond(serialize(hook, request.user))

    def put(self, request: Request, project, hook_id) -> Response:
        """
        Update a Service Hook
        `````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :pparam string hook_id: the guid of the service hook.
        :param string url: the url for the webhook
        :param array[string] events: the events to subscribe to
        :auth: required
        """
        if not request.user.is_authenticated:
            return self.respond(status=401)

        try:
            hook = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist

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

        with transaction.atomic():
            hook.update(**updates)

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=hook.id,
                event=audit_log.get_event_id("SERVICEHOOK_EDIT"),
                data=hook.get_audit_log_data(),
            )

        return self.respond(serialize(hook, request.user))

    def delete(self, request: Request, project, hook_id) -> Response:
        """
        Remove a Service Hook
        `````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          client keys belong to.
        :pparam string project_slug: the slug of the project the client keys
                                     belong to.
        :pparam string hook_id: the guid of the service hook.
        :auth: required
        """
        if not request.user.is_authenticated:
            return self.respond(status=401)

        try:
            hook = ServiceHook.objects.get(project_id=project.id, guid=hook_id)
        except ServiceHook.DoesNotExist:
            raise ResourceDoesNotExist

        with transaction.atomic():
            hook.delete()

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=hook.id,
                event=audit_log.get_event_id("SERVICEHOOK_REMOVE"),
                data=hook.get_audit_log_data(),
            )

        return self.respond(status=204)
