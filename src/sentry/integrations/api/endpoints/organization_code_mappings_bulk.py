import logging

from django.db import IntegrityError, router, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationCodeMappingsBulkPermission,
    OrganizationEndpoint,
)
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.api.endpoints.organization_code_mappings import (
    BRANCH_NAME_ERROR_MESSAGE,
    gen_path_regex_field,
)
from sentry.integrations.models.repository_project_path_config import (
    RepositoryProjectPathConfig,
    process_resource_change,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

MAX_MAPPINGS = 300


class MappingItemSerializer(serializers.Serializer):
    stack_root = gen_path_regex_field()
    source_root = gen_path_regex_field()


class BulkCodeMappingsRequestSerializer(CamelSnakeSerializer):
    project = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)
    default_branch = serializers.RegexField(
        r"^(^(?![\/]))([\w\.\/-]+)(?<![\/])$",
        required=False,
        allow_blank=True,
        error_messages={"invalid": _(BRANCH_NAME_ERROR_MESSAGE)},
    )
    mappings = MappingItemSerializer(many=True, required=True)

    def validate_mappings(self, mappings):
        if len(mappings) > MAX_MAPPINGS:
            raise serializers.ValidationError(
                f"A maximum of {MAX_MAPPINGS} mappings can be submitted at once."
            )
        if len(mappings) == 0:
            raise serializers.ValidationError("At least one mapping is required.")
        return mappings


@region_silo_endpoint
class OrganizationCodeMappingsBulkEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationCodeMappingsBulkPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = BulkCodeMappingsRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolve project by slug
        try:
            project = Project.objects.get(
                organization=organization,
                slug=data["project"],
                status=ObjectStatus.ACTIVE,
            )
        except Project.DoesNotExist:
            return Response(
                {"detail": f"Project not found: {data['project']}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not request.access.has_project_access(project):
            return Response(
                {"detail": "You do not have access to this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Resolve repository by name
        try:
            repo = Repository.objects.get(
                organization_id=organization.id,
                name=data["repository"],
                status=ObjectStatus.ACTIVE,
            )
        except Repository.DoesNotExist:
            return Response(
                {"detail": f"Repository not found: {data['repository']}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Repository.MultipleObjectsReturned:
            return Response(
                {
                    "detail": f"Multiple repositories found with name: {data['repository']}. Please ensure repository names are unique."
                },
                status=status.HTTP_409_CONFLICT,
            )

        if not repo.integration_id:
            return Response(
                {"detail": "Repository is not associated with an integration."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve organization integration
        org_integration = integration_service.get_organization_integration(
            integration_id=repo.integration_id, organization_id=organization.id
        )
        if not org_integration:
            return Response(
                {"detail": "Integration is not installed on this organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate default_branch
        default_branch = data.get("default_branch", "")
        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if (
            not default_branch
            and integration
            and integration.provider != IntegrationProviderSlug.PERFORCE
        ):
            return Response(
                {"detail": "defaultBranch is required for this integration type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mappings = data["mappings"]
        results = []
        has_errors = False
        last_saved_config = None

        defaults = {
            "repository": repo,
            "organization_integration_id": org_integration.id,
            "organization_id": organization.id,
            "integration_id": repo.integration_id,
            "default_branch": default_branch,
            "automatically_generated": False,
        }

        for mapping in mappings:
            try:
                with transaction.atomic(using=router.db_for_write(RepositoryProjectPathConfig)):
                    try:
                        config = RepositoryProjectPathConfig.objects.select_for_update().get(
                            project=project,
                            stack_root=mapping["stack_root"],
                        )
                        for key, value in {
                            **defaults,
                            "source_root": mapping["source_root"],
                        }.items():
                            setattr(config, key, value)
                        created = False
                    except RepositoryProjectPathConfig.DoesNotExist:
                        config = RepositoryProjectPathConfig(
                            project=project,
                            stack_root=mapping["stack_root"],
                            source_root=mapping["source_root"],
                            **defaults,
                        )
                        created = True
                    config._skip_post_save = True
                    config.save()
                last_saved_config = config
                results.append(
                    {
                        "stackRoot": mapping["stack_root"],
                        "sourceRoot": mapping["source_root"],
                        "status": "created" if created else "updated",
                    }
                )
            except IntegrityError:
                logger.exception(
                    "bulk_code_mappings.mapping_error",
                    extra={
                        "organization_id": organization.id,
                        "project_id": project.id,
                        "stack_root": mapping["stack_root"],
                    },
                )
                has_errors = True
                results.append(
                    {
                        "stackRoot": mapping["stack_root"],
                        "sourceRoot": mapping["source_root"],
                        "status": "error",
                        "detail": "Failed to save mapping.",
                    }
                )

        # Fire side effects once for the entire batch.
        if last_saved_config is not None:
            last_saved_config._skip_post_save = False
            process_resource_change(last_saved_config)

        created_count = sum(1 for r in results if r["status"] == "created")
        updated_count = sum(1 for r in results if r["status"] == "updated")
        error_count = sum(1 for r in results if r["status"] == "error")

        response_data = {
            "created": created_count,
            "updated": updated_count,
            "errors": error_count,
            "mappings": results,
        }

        if has_errors:
            return Response(response_data, status=207)

        return Response(response_data, status=status.HTTP_200_OK)
