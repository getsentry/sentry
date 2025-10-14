from typing import Any

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN
from sentry.apidocs.parameters import GlobalParams
from sentry.integrations.api.serializers.models.data_forwarder import (
    DataForwarderSerializer as DataForwarderModelSerializer,
)
from sentry.integrations.api.serializers.rest_framework.data_forwarder import (
    DataForwarderSerializer,
)
from sentry.integrations.models.data_forwarder import DataForwarder
from sentry.integrations.models.data_forwarder_project import DataForwarderProject
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.web.decorators import set_referrer_policy


class OrganizationDataForwardingDetailsPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:write", "project:write"],
        "DELETE": ["org:write"],
    }


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class DataForwardingDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationDataForwardingDetailsPermission,)

    def _update_data_forwarder_config(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> Response:
        data = request.data
        data["organization_id"] = organization.id

        serializer = DataForwarderSerializer(data_forwarder, data=data)
        if serializer.is_valid():
            data_forwarder = serializer.save()
            return Response(
                serialize(data_forwarder, request.user),
                status=status.HTTP_200_OK,
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _validate_project_ids_input(
        self, request: Request
    ) -> tuple[list[int] | None, Response | None]:
        raw_project_ids: Any = request.data.get("project_ids")
        if raw_project_ids is None or not isinstance(raw_project_ids, list):
            return None, self.respond(
                {"project_ids": ["This field is required and must be a list"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return raw_project_ids, None

    def _get_accessible_projects_to_unenroll(
        self, request: Request, organization: Organization, enrolled_project_ids: list[int]
    ) -> tuple[list[int] | None, Response | None]:
        projects_to_unenroll: list[int] = []
        for project_id in enrolled_project_ids:
            try:
                project = Project.objects.get(id=project_id, organization_id=organization.id)
                if request.access.has_project_scope(project, "project:write"):
                    projects_to_unenroll.append(project_id)
            except Project.DoesNotExist:
                pass
        return projects_to_unenroll, None

    def _handle_unenroll_all_projects(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> Response:
        enrolled_projects = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder
        ).values_list("project_id", flat=True)

        projects_to_unenroll, error_response = self._get_accessible_projects_to_unenroll(
            request, organization, list(enrolled_projects)
        )
        if error_response:
            return error_response

        if projects_to_unenroll:
            DataForwarderProject.objects.filter(
                data_forwarder=data_forwarder, project_id__in=projects_to_unenroll
            ).delete()

        return Response(
            serialize(data_forwarder, request.user),
            status=status.HTTP_200_OK,
        )

    def _validate_project_permissions(
        self, request: Request, projects: list[Project]
    ) -> Response | None:
        unauthorized_projects: list[int] = []
        for project in projects:
            if not request.access.has_project_scope(project, "project:write"):
                unauthorized_projects.append(project.id)
        if unauthorized_projects:
            return self.respond(
                {
                    "project_ids": [
                        f"Insufficient access to projects: {', '.join(map(str, unauthorized_projects))}"
                    ]
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def _validate_projects_exist(
        self, projects: list[Project], project_ids: list[int]
    ) -> Response | None:
        if len(projects) != len(project_ids):
            found_ids = {project.id for project in projects}
            invalid_ids = set(project_ids) - found_ids
            return self.respond(
                {
                    "project_ids": [
                        f"Invalid project IDs for this organization: {', '.join(map(str, invalid_ids))}"
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def _get_accessible_enrolled_projects(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> list[int]:
        enrolled_projects = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder
        ).values_list("project_id", flat=True)

        accessible_enrolled_projects: list[int] = []
        for project_id in enrolled_projects:
            try:
                project = Project.objects.get(id=project_id, organization_id=organization.id)
                if request.access.has_project_scope(project, "project:write"):
                    accessible_enrolled_projects.append(project_id)
            except Project.DoesNotExist:
                pass
        return accessible_enrolled_projects

    def _enroll_or_update_projects(
        self,
        data_forwarder: DataForwarder,
        project_ids: list[int],
        overrides: dict[str, Any],
        is_enabled: bool | None,
    ) -> None:
        for project_id in project_ids:
            defaults: dict[str, Any] = {
                "is_enabled": is_enabled if is_enabled is not None else True
            }
            if overrides:
                defaults["overrides"] = overrides

            project_config, created = DataForwarderProject.objects.get_or_create(
                data_forwarder=data_forwarder,
                project_id=project_id,
                defaults=defaults,
            )

            if created:
                continue
            if overrides:
                project_config.overrides = overrides
            if is_enabled is not None:
                project_config.is_enabled = is_enabled
            project_config.save()

    def _unenroll_removed_projects(
        self,
        data_forwarder: DataForwarder,
        accessible_enrolled_projects: list[int],
        project_ids: list[int],
    ) -> None:
        projects_to_unenroll = set(accessible_enrolled_projects) - set(project_ids)
        if projects_to_unenroll:
            DataForwarderProject.objects.filter(
                data_forwarder=data_forwarder, project_id__in=projects_to_unenroll
            ).delete()

    @set_referrer_policy("strict-origin-when-cross-origin")
    @method_decorator(never_cache)
    @extend_schema(
        operation_id="Update a Data Forwarding Configuration for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DataForwarderSerializer,
        responses={
            200: DataForwarderModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def put(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> Response:
        if request.access.has_scope("org:write"):
            return self._update_data_forwarder_config(request, organization, data_forwarder)
        else:  # project:write permission

            project_ids, error_response = self._validate_project_ids_input(request)
            if error_response:
                return error_response

            overrides: dict[str, Any] = request.data.get("overrides", {})
            is_enabled: bool | None = request.data.get("is_enabled")

            if not project_ids:
                return self._handle_unenroll_all_projects(request, organization, data_forwarder)

            projects = Project.objects.filter(organization_id=organization.id, id__in=project_ids)

            error_response = self._validate_project_permissions(request, list(projects))
            if error_response:
                return error_response

            error_response = self._validate_projects_exist(list(projects), project_ids)
            if error_response:
                return error_response

            accessible_enrolled_projects = self._get_accessible_enrolled_projects(
                request, organization, data_forwarder
            )

            self._enroll_or_update_projects(data_forwarder, project_ids, overrides, is_enabled)
            self._unenroll_removed_projects(
                data_forwarder, accessible_enrolled_projects, project_ids
            )

            return Response(
                serialize(data_forwarder, request.user),
                status=status.HTTP_200_OK,
            )

    def delete(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> Response:
        DataForwarderProject.objects.filter(data_forwarder=data_forwarder).delete()
        data_forwarder.delete()
        return self.respond(status=status.HTTP_204_NO_CONTENT)
