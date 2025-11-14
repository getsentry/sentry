from typing import int
from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import deletions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.projects.services.project.service import project_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.serializers.servicehookproject import ServiceHookProjectSerializer
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation


class ProjectAccessError(Exception):
    pass


class ServiceHookProjectsInputSerializer(serializers.Serializer):
    projects = serializers.ListField(required=True)

    def validate_projects(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Projects must be a list, not %s" % type(value).__name__
            )

        if not value:
            raise serializers.ValidationError("Projects list cannot be empty")

        # Check the type of the first element to determine expected type
        first_elem = value[0]

        if not isinstance(first_elem, (str, int)):
            raise serializers.ValidationError(
                "Project identifiers must be either all strings (slugs) or all integers (IDs)"
            )

        expected_type = type(first_elem)

        # Verify all elements are of the same type
        if not all(isinstance(x, expected_type) for x in value):
            raise serializers.ValidationError(
                "Mixed types detected. All project identifiers must be of the same type "
                "(either all strings/slugs or all integers/IDs)"
            )

        return value


@region_silo_endpoint
class SentryAppInstallationServiceHookProjectsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _replace_hook_projects(
        self, installation: RpcSentryAppInstallation, new_project_ids: set[int], request: Request
    ) -> list[ServiceHookProject]:
        with transaction.atomic(router.db_for_write(ServiceHookProject)):
            hook = ServiceHook.objects.get(installation_id=installation.id)
            existing_project_ids = set(
                ServiceHookProject.objects.filter(service_hook_id=hook.id).values_list(
                    "project_id", flat=True
                )
            )

            # Determine which projects to add and which to remove
            projects_to_add = new_project_ids - existing_project_ids
            projects_to_remove = existing_project_ids - new_project_ids

            for p in projects_to_remove:
                p_obj = project_service.get_by_id(
                    organization_id=installation.organization_id, id=p
                )
                if not request.access.has_project_access(p_obj):
                    raise ProjectAccessError("Can not remove projects that are not accessible")

            self._delete_servicehookprojects(hook.id, projects_to_remove)
            added_hook_projects = self._add_servicehookprojects(hook.id, projects_to_add)

            kept_project_ids = existing_project_ids & new_project_ids
            return sorted(
                added_hook_projects
                + list(ServiceHookProject.objects.filter(project_id__in=kept_project_ids)),
                key=lambda x: x.project_id,
            )

    def _delete_servicehookprojects(self, service_hook_id: int, project_ids: set[int]) -> None:
        ServiceHookProject.objects.filter(
            service_hook_id=service_hook_id, project_id__in=project_ids
        ).delete()

    def _add_servicehookprojects(
        self, service_hook_id: int, project_ids: set[int]
    ) -> list[ServiceHookProject]:
        res = []
        for project_id in project_ids:
            res.append(
                ServiceHookProject.objects.create(
                    project_id=project_id,
                    service_hook_id=service_hook_id,
                )
            )
        return res

    def get(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        hook = ServiceHook.objects.get(installation_id=installation.id)
        hook_projects = list(ServiceHookProject.objects.filter(service_hook_id=hook.id))

        for hp in hook_projects:
            p_obj = project_service.get_by_id(
                organization_id=installation.organization_id, id=hp.project_id
            )
            if not request.access.has_project_access(p_obj):
                return Response(
                    status=400,
                    data={"error": "Some projects are not accessible"},
                )

        return self.paginate(
            request=request,
            queryset=hook_projects,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ServiceHookProjectSerializer()
            ),
        )

    """
        POST will replace all existing project filters with the new set.
    """

    def post(self, request: Request, installation: RpcSentryAppInstallation) -> Response:

        serializer = ServiceHookProjectsInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        projects = serializer.validated_data["projects"]

        # convert slugs to ids if needed
        org_id = installation.organization_id
        project_ids = set()
        for project in set(projects):
            if isinstance(project, int):
                project_obj = project_service.get_by_id(organization_id=org_id, id=project)
            else:
                project_obj = project_service.get_by_slug(organization_id=org_id, slug=project)
            if project_obj and request.access.has_project_access(project_obj):
                project_ids.add(project_obj.id)
            else:
                return Response(
                    status=400,
                    data={"error": f"Project '{project}' does not exist or is not accessible"},
                )

        try:
            hook_projects = self._replace_hook_projects(installation, project_ids, request)
        except ProjectAccessError:
            return Response(
                status=400,
                data={"error": "Some projects affected by this request are not accessible"},
            )

        return self.paginate(
            request=request,
            queryset=hook_projects,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ServiceHookProjectSerializer()
            ),
        )

    def delete(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        hook = ServiceHook.objects.get(installation_id=installation.id)
        hook_projects = ServiceHookProject.objects.filter(service_hook_id=hook.id)
        for hp in hook_projects:
            p_obj = project_service.get_by_id(
                organization_id=installation.organization_id, id=hp.project_id
            )
            if not request.access.has_project_access(p_obj):
                return Response(
                    status=400,
                    data={"error": "Some projects affected by this request are not accessible"},
                )
        deletions.exec_sync_many(list(hook_projects))
        return Response(status=204)
