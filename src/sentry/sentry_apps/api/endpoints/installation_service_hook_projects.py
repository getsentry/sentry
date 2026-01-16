from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import all_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.projects.services.project.service import project_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.serializers.servicehookproject import ServiceHookProjectSerializer
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.region import sentry_app_region_service


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


@all_silo_endpoint
class SentryAppInstallationServiceHookProjectsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        result = sentry_app_region_service.get_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
        )
        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        for project in result.projects:
            if not request.access.has_project_access(project):
                return Response(
                    status=400,
                    data={"error": "Some projects are not accessible"},
                )

        return self.paginate(
            request=request,
            queryset=result.service_hook_projects,
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

        # Convert slugs to ids if needed and check access
        org_id = installation.organization_id
        project_ids = []
        for project in set(projects):
            if isinstance(project, int):
                project_obj = project_service.get_by_id(organization_id=org_id, id=project)
            else:
                project_obj = project_service.get_by_slug(organization_id=org_id, slug=project)
            if project_obj and request.access.has_project_access(project_obj):
                project_ids.append(project_obj.id)
            else:
                return Response(
                    status=400,
                    data={"error": f"Project '{project}' does not exist or is not accessible"},
                )

        current_result = sentry_app_region_service.get_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
        )
        if current_result.error:
            return self.respond_rpc_sentry_app_error(current_result.error)

        current_project_ids = {hp.project_id for hp in current_result.service_hook_projects}
        project_ids_to_remove = current_project_ids - set(project_ids)
        projects_to_remove = [
            project for project in current_result.projects if project.id in project_ids_to_remove
        ]
        for project in projects_to_remove:
            if not request.access.has_project_access(project):
                return Response(
                    status=400,
                    data={"error": "Some projects affected by this request are not accessible"},
                )

        result = sentry_app_region_service.set_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
            project_ids=project_ids,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return self.paginate(
            request=request,
            queryset=result.service_hook_projects,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ServiceHookProjectSerializer()
            ),
        )

    def delete(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        current_result = sentry_app_region_service.get_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
        )

        if current_result.error:
            return self.respond_rpc_sentry_app_error(current_result.error)

        for project in current_result.projects:
            if not request.access.has_project_access(project):
                return Response(
                    status=400,
                    data={"error": "Some projects affected by this request are not accessible"},
                )

        result = sentry_app_region_service.delete_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(status=204)
