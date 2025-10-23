from typing import Any

from django.db import router, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
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
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.web.decorators import set_referrer_policy


class OrganizationDataForwardingDetailsPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["org:write"],
        "DELETE": ["org:write"],
    }

    def has_object_permission(
        self,
        request: Request,
        view: APIView,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        if super().has_object_permission(request, view, organization):
            return True

        if request.method == "PUT":
            self.determine_access(request, organization)
            return len(request.access.team_ids_with_membership) > 0

        return False


@region_silo_endpoint
@extend_schema(tags=["Integrations"])
class DataForwardingDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationDataForwardingDetailsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        data_forwarder_id: int,
        *args,
        **kwargs,
    ):
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            data_forwarder = DataForwarder.objects.get(
                id=data_forwarder_id,
                organization=kwargs["organization"],
            )
        except DataForwarder.DoesNotExist:
            raise ResourceDoesNotExist

        kwargs["data_forwarder"] = data_forwarder
        return args, kwargs

    def _update_data_forwarder_config(
        self, request: Request, organization: Organization, data_forwarder: DataForwarder
    ) -> Response:
        """
        Returns:
            Response: 200 OK with serialized data forwarder on success,
                     400 Bad Request with validation errors on failure
        """
        data = request.data
        data["organization_id"] = organization.id

        serializer = DataForwarderSerializer(
            data_forwarder, data=data, context={"organization": organization}
        )
        if serializer.is_valid():
            data_forwarder = serializer.save()
            return Response(
                serialize(data_forwarder, request.user),
                status=status.HTTP_200_OK,
            )
        return self.respond(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _validate_project_ids_input(self, request: Request) -> list[int]:
        raw_project_ids = request.data.get("project_ids")
        if raw_project_ids is None or not isinstance(raw_project_ids, list):
            raise serializers.ValidationError(
                {"project_ids": ["This field is required and must be a list"]}
            )
        return raw_project_ids

    def _validate_projects_exist(self, projects: list[Project], project_ids: list[int]) -> None:
        if len(projects) != len(project_ids):
            found_ids = {project.id for project in projects}
            invalid_ids = set(project_ids) - found_ids
            raise serializers.ValidationError(
                {
                    "project_ids": [
                        f"Invalid project IDs for this organization: {', '.join(map(str, invalid_ids))}"
                    ]
                }
            )

    def _validate_project_permissions(self, request: Request, projects: list[Project]) -> None:
        """
        Validate that the user has project:write permission for all specified projects.

        Raises:
            PermissionDenied: If user lacks access to any project
        """
        unauthorized_projects: list[int] = []
        for project in projects:
            if not request.access.has_project_scope(project, "project:write"):
                unauthorized_projects.append(project.id)
        if unauthorized_projects:
            raise PermissionDenied(
                detail={
                    "project_ids": [
                        f"Insufficient access to projects: {', '.join(map(str, unauthorized_projects))}"
                    ]
                }
            )

    def _validate_projects_config(self, request: Request, project_ids: list[int]) -> None:
        """
        Validate the projects_config structure if provided.

        Expected format: {"projects_config": {project_id: {"overrides": {...}, "is_enabled": bool}}}

        Raises:
            ValidationError: If projects_config has invalid structure
        """
        projects_config = request.data.get("projects_config")
        if projects_config is None:
            return

        if not isinstance(projects_config, dict):
            raise serializers.ValidationError(
                {"projects_config": ["Must be a dictionary mapping project IDs to configuration"]}
            )

        for project_id_key, config in projects_config.items():
            # Validate that the key is a valid project ID (as string or int)
            try:
                project_id = int(project_id_key)
            except (ValueError, TypeError):
                raise serializers.ValidationError(
                    {"projects_config": [f"Invalid project ID key: {project_id_key}"]}
                )

            # Validate that the config is a dictionary
            if not isinstance(config, dict):
                raise serializers.ValidationError(
                    {
                        "projects_config": [
                            f"Configuration for project {project_id} must be a dictionary"
                        ]
                    }
                )

            # Validate is_enabled field if present
            if "is_enabled" in config and not isinstance(config["is_enabled"], bool):
                raise serializers.ValidationError(
                    {"projects_config": [f"is_enabled for project {project_id} must be a boolean"]}
                )

            # Validate overrides field if present
            if "overrides" in config and not isinstance(config["overrides"], dict):
                raise serializers.ValidationError(
                    {
                        "projects_config": [
                            f"overrides for project {project_id} must be a dictionary"
                        ]
                    }
                )

    def _enroll_or_update_projects(
        self,
        request: Request,
        data_forwarder: DataForwarder,
        project_ids: list[int],
    ) -> None:
        # Extract per-project configuration if provided
        # Format: {"projects_config": {project_id: {"overrides": {...}, "is_enabled": true}}}
        projects_config = request.data.get("projects_config", {})

        with transaction.atomic(router.db_for_write(DataForwarderProject)):
            for project_id in project_ids:
                # Get per-project settings (try both string and int keys since JSON uses strings)
                project_settings = projects_config.get(
                    str(project_id), projects_config.get(project_id)
                )

                # Prepare defaults for creating new projects
                defaults: dict[str, Any] = {}

                if project_settings is not None:
                    # Use per-project configuration
                    defaults["is_enabled"] = project_settings.get("is_enabled", True)
                    if "overrides" in project_settings:
                        defaults["overrides"] = project_settings["overrides"]
                else:
                    # Fallback to legacy format (same config for all projects)
                    defaults["is_enabled"] = request.data.get("is_enabled", True)
                    if "overrides" in request.data:
                        defaults["overrides"] = request.data["overrides"]

                project_config, created = DataForwarderProject.objects.get_or_create(
                    data_forwarder=data_forwarder,
                    project_id=project_id,
                    defaults=defaults,
                )

                if created:
                    continue

                # Update existing project with per-project or legacy settings
                if project_settings is not None:
                    if "is_enabled" in project_settings:
                        project_config.is_enabled = project_settings["is_enabled"]
                    if "overrides" in project_settings:
                        project_config.overrides = project_settings["overrides"]
                else:
                    # Legacy format - update if fields present in top-level request
                    if "is_enabled" in request.data:
                        project_config.is_enabled = request.data["is_enabled"]
                    if "overrides" in request.data:
                        project_config.overrides = request.data["overrides"]
                project_config.save()

    def _unenroll_removed_projects(
        self,
        data_forwarder: DataForwarder,
        organization: Organization,
        request: Request,
        project_ids: list[int],
    ) -> None:
        enrolled_projects: list[int] = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder
        ).values_list("project_id", flat=True)

        accessible_enrolled_projects: list[int] = []
        unauthorized_projects: list[int] = []
        projects = Project.objects.filter(organization_id=organization.id, id__in=enrolled_projects)
        for project in projects:
            if request.access.has_project_scope(project, "project:write"):
                accessible_enrolled_projects.append(project.id)
            else:
                unauthorized_projects.append(project.id)
        if unauthorized_projects:
            raise PermissionDenied(
                detail={
                    "project_ids": [
                        f"Insufficient access to projects: {', '.join(map(str, unauthorized_projects))}"
                    ]
                }
            )

        project_ids_to_unenroll = set(accessible_enrolled_projects) - set(project_ids)
        projects_to_unenroll = DataForwarderProject.objects.filter(
            data_forwarder=data_forwarder, project__id__in=project_ids_to_unenroll
        )
        with transaction.atomic(router.db_for_write(DataForwarderProject)):
            projects_to_unenroll.delete()

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

        # otherwise, user must have project:write permissions
        project_ids = self._validate_project_ids_input(request)

        projects = list(Project.objects.filter(organization_id=organization.id, id__in=project_ids))
        self._validate_projects_exist(projects, project_ids)
        self._validate_project_permissions(request, projects)
        self._validate_projects_config(request, project_ids)

        self._enroll_or_update_projects(request, data_forwarder, project_ids)
        self._unenroll_removed_projects(data_forwarder, organization, request, project_ids)

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
