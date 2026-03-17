import logging

from django.db import IntegrityError, router, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
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
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

MAX_MAPPINGS = 300


class MappingItemSerializer(serializers.Serializer[dict[str, object]]):
    stack_root = gen_path_regex_field()
    source_root = gen_path_regex_field()


class BulkCodeMappingsRequestSerializer(CamelSnakeSerializer[dict[str, object]]):
    project = serializers.CharField(required=True)
    repository = serializers.CharField(required=True)
    provider = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    default_branch = serializers.RegexField(
        r"^(^(?![\/]))([\w\.\/-]+)(?<![\/])$",
        required=False,
        allow_blank=True,  # Perforce allows empty streams
        error_messages={"invalid": _(BRANCH_NAME_ERROR_MESSAGE)},
    )
    mappings = MappingItemSerializer(many=True, required=True)

    def validate_mappings(self, mappings: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(mappings) > MAX_MAPPINGS:
            raise serializers.ValidationError(
                f"A maximum of {MAX_MAPPINGS} mappings can be submitted at once."
            )
        if len(mappings) == 0:
            raise serializers.ValidationError("At least one mapping is required.")
        return mappings


@cell_silo_endpoint
class OrganizationCodeMappingsBulkEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationCodeMappingsBulkPermission,)

    @staticmethod
    def _auto_create_repository(
        organization: Organization,
        repo_name: str,
        provider: str,
    ) -> tuple[Repository | None, Response | None]:
        """
        Auto-create a Repository if the provider integration can verify it exists.
        Returns (repo, None) on success or (None, error_response) on failure.
        """
        # Normalize provider: strip "integrations:" prefix if present
        short_provider = provider.removeprefix("integrations:")
        repo_provider = f"integrations:{short_provider}"

        org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id, providers=[short_provider]
        )
        if not org_integrations:
            return None, Response(
                {"detail": f"No {provider} integration installed on this organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use the first matching integration
        org_int = org_integrations[0]
        integration = integration_service.get_integration(integration_id=org_int.integration_id)
        if not integration:
            return None, None  # Fall through to 404

        try:
            install = integration.get_installation(organization_id=organization.id)
        except Exception:
            logger.exception("bulk_code_mappings.auto_create_repo.get_installation_error")
            return None, None

        if not isinstance(install, RepositoryIntegration):
            return None, None

        # Verify the repo exists on the provider
        try:
            repositories = install.get_repositories(query=repo_name)
        except Exception:
            logger.exception("bulk_code_mappings.auto_create_repo.get_repositories_error")
            return None, None

        repo_info = RepositoryIntegration.find_repo_info(repositories, repo_name)

        if not repo_info:
            return None, None  # Repo doesn't exist on provider, fall through to 404

        repo, _ = Repository.objects.get_or_create(
            name=repo_name,
            organization_id=organization.id,
            provider=repo_provider,
            defaults={
                "integration_id": org_int.integration_id,
            },
        )
        return repo, None

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
                {"detail": f"Project not found or not active: {data['project']}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not request.access.has_project_access(project):
            return Response(
                {"detail": "You do not have access to this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Resolve repository by name (and optionally provider)
        repo_filter = Repository.objects.filter(
            organization_id=organization.id,
            name=data["repository"],
            status=ObjectStatus.ACTIVE,
        )
        provider = (data.get("provider") or "").strip()
        if provider:
            repo_filter = repo_filter.filter(provider__in=[provider, f"integrations:{provider}"])
        repos = list(repo_filter[:2])  # Only need 2 to detect duplicates

        if len(repos) > 1:
            return Response(
                {
                    "detail": f"Multiple repositories found with name: {data['repository']}. "
                    "Provide the provider field (e.g. 'github', 'gitlab') to disambiguate."
                },
                status=status.HTTP_409_CONFLICT,
            )

        repo: Repository | None = repos[0] if repos else None

        # Auto-create repository if not found and provider is given
        if repo is None and provider:
            repo, error_response = self._auto_create_repository(
                organization, data["repository"], provider
            )
            if error_response:
                return error_response

        if repo is None:
            return Response(
                {"detail": f"Repository not found: {data['repository']}"},
                status=status.HTTP_404_NOT_FOUND,
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

        # Resolve default_branch: use provided value, or infer from integration
        default_branch = data.get("default_branch", "")
        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if not default_branch and integration:
            if integration.provider != IntegrationProviderSlug.PERFORCE:
                try:
                    install = integration.get_installation(organization_id=organization.id)
                    if isinstance(install, RepositoryIntegration):
                        default_branch = install.get_repository_default_branch(repo) or ""
                except Exception:
                    logger.exception("bulk_code_mappings.branch_inference_error")
                if not default_branch:
                    return Response(
                        {
                            "detail": "Could not determine the default branch. Please provide defaultBranch explicitly."
                        },
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
