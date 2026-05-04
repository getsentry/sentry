from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import enforce_constraints
from sentry.integrations.gitlab.tasks import update_all_project_webhooks
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.repository import RepositoryService, RpcRepository
from sentry.integrations.services.repository.model import RpcCreateRepository
from sentry.integrations.services.repository.serial import serialize_repository
from sentry.models.code_review_event import CodeReviewEvent
from sentry.models.commit import Commit
from sentry.models.options.project_option import ProjectOption
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.users.services.user.model import RpcUser


class DatabaseBackedRepositoryService(RepositoryService):
    def serialize_repository(
        self,
        *,
        organization_id: int,
        id: int,
        as_user: RpcUser | None = None,
    ) -> Any | None:
        repository = Repository.objects.filter(organization_id=organization_id, id=id).first()
        if repository is None:
            return None
        return serialize(repository, user=as_user)

    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        external_id: int | None = None,
        providers: list[str] | None = None,
        has_integration: bool | None = None,
        has_provider: bool | None = None,
        status: int | None = None,
    ) -> list[RpcRepository]:
        query = Repository.objects.filter(organization_id=organization_id)
        if integration_id is not None:
            query = query.filter(integration_id=integration_id)
        if external_id is not None:
            query = query.filter(external_id=external_id)
        if providers is not None:
            query = query.filter(provider__in=providers)
        if has_integration is not None:
            query = query.filter(integration_id__isnull=not has_integration)
        if has_provider is not None:
            query = query.filter(provider__isnull=not has_provider)
        if status is not None:
            query = query.filter(status=status)
        return [serialize_repository(repo) for repo in query]

    def get_repository(self, *, organization_id: int, id: int) -> RpcRepository | None:
        repository = Repository.objects.filter(organization_id=organization_id, id=id).first()
        if repository is None:
            return None
        return serialize_repository(repository)

    def create_repository(
        self, *, organization_id: int, create: RpcCreateRepository
    ) -> RpcRepository | None:
        try:
            with enforce_constraints(transaction.atomic(router.db_for_write(Repository))):
                repository = Repository.objects.create(
                    organization_id=organization_id, **create.dict()
                )
                return serialize_repository(repository)
        except IntegrityError:
            return None

    def update_repository(self, *, organization_id: int, update: RpcRepository) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            repository = (
                Repository.objects.filter(organization_id=organization_id, id=update.id)
                .select_for_update()
                .first()
            )
            if repository is None:
                return

            update_dict = update.dict()
            del update_dict["id"]

            for field_name, field_value in update_dict.items():
                setattr(repository, field_name, field_value)

            repository.save()

    def update_repositories(self, *, organization_id: int, updates: list[RpcRepository]) -> None:
        if not updates:
            return

        update_mapping: dict[int, dict[str, Any]] = {}
        for update in updates:
            update_dict = update.dict()
            del update_dict["id"]  # don't update the repo ID
            update_mapping[update.id] = update_dict

        if len(update_mapping.keys()) != len(updates):
            raise Exception("Multiple updates for the same repository are not allowed.")

        # we could be updating everything except the repo IDs, so we need to collect the fields
        fields_to_update = set(list(update_mapping.values())[0].keys())

        with transaction.atomic(router.db_for_write(Repository)):
            repositories = (
                Repository.objects.filter(
                    organization_id=organization_id, id__in=update_mapping.keys()
                )
                .select_for_update()
                .order_by("id")
            )

            # Apply updates to each repository object
            for repository in repositories:
                repo_update = update_mapping[repository.id]
                for field_name, field_value in repo_update.items():
                    setattr(repository, field_name, field_value)

            Repository.objects.bulk_update(repositories, fields=list(fields_to_update))

    def disable_repositories_for_integration(
        self, *, organization_id: int, integration_id: int, provider: str
    ) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            Repository.objects.filter(
                organization_id=organization_id,
                integration_id=integration_id,
                provider=provider,
            ).update(status=ObjectStatus.DISABLED)

    def find_recently_active_repo_external_ids(
        self,
        *,
        organization_id: int,
        integration_id: int,
        provider: str,
        external_ids: list[str],
        cutoff_days: int,
    ) -> list[str]:
        if not external_ids:
            return []

        cutoff = timezone.now() - timedelta(days=cutoff_days)
        repo_id_to_external = dict(
            Repository.objects.filter(
                organization_id=organization_id,
                integration_id=integration_id,
                provider=provider,
                external_id__in=external_ids,
                status=ObjectStatus.ACTIVE,
            ).values_list("id", "external_id")
        )
        if not repo_id_to_external:
            return []

        repo_ids = list(repo_id_to_external.keys())
        active_repo_ids: set[int] = set()

        active_repo_ids.update(
            Commit.objects.filter(
                repository_id__in=repo_ids,
                date_added__gte=cutoff,
            )
            .values_list("repository_id", flat=True)
            .distinct()
        )
        active_repo_ids.update(
            PullRequest.objects.filter(
                repository_id__in=repo_ids,
                date_added__gte=cutoff,
            )
            .values_list("repository_id", flat=True)
            .distinct()
        )
        active_repo_ids.update(
            CodeReviewEvent.objects.filter(
                organization_id=organization_id,
                repository_id__in=repo_ids,
                trigger_at__gte=cutoff,
            )
            .values_list("repository_id", flat=True)
            .distinct()
        )
        return [
            eid
            for rid, eid in repo_id_to_external.items()
            if rid in active_repo_ids and eid is not None
        ]

    def disable_repositories_by_external_ids(
        self,
        *,
        organization_id: int,
        integration_id: int,
        provider: str,
        external_ids: list[str],
    ) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            repo_ids = list(
                Repository.objects.filter(
                    organization_id=organization_id,
                    integration_id=integration_id,
                    provider=provider,
                    external_id__in=external_ids,
                    status=ObjectStatus.ACTIVE,
                ).values_list("id", flat=True)
            )

            if repo_ids:
                Repository.objects.filter(id__in=repo_ids).update(status=ObjectStatus.DISABLED)

    def disassociate_organization_integration(
        self,
        *,
        organization_id: int,
        organization_integration_id: int,
        integration_id: int,
    ) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            repo_ids = list(
                Repository.objects.filter(
                    organization_id=organization_id, integration_id=integration_id
                ).values_list("id", flat=True)
            )
            if repo_ids:
                # Disassociate repos from the organization integration being deleted
                Repository.objects.filter(id__in=repo_ids).update(integration_id=None)

                # Delete Seer preferences for this repository
                SeerProjectRepository.objects.filter(
                    repository_id__in=repo_ids,
                    project__organization_id=organization_id,
                ).delete()

            # Delete Code Owners with a Code Mapping using the OrganizationIntegration
            ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=RepositoryProjectPathConfig.objects.filter(
                    organization_integration_id=organization_integration_id
                ).values_list("id", flat=True)
            ).delete()

            # Delete the Code Mappings
            RepositoryProjectPathConfig.objects.filter(
                organization_integration_id=organization_integration_id
            ).delete()

            # Clear automation_handoff project options that reference this integration.
            affected_project_ids = ProjectOption.objects.filter(
                project__organization_id=organization_id,
                key="sentry:seer_automation_handoff_integration_id",
                value=integration_id,
            ).values("project_id")
            ProjectOption.objects.filter(
                project_id__in=affected_project_ids,
                key__in={
                    "sentry:seer_automation_handoff_integration_id",
                    "sentry:seer_automation_handoff_point",
                    "sentry:seer_automation_handoff_target",
                    "sentry:seer_automation_handoff_auto_create_pr",
                },
            ).delete()

    def schedule_update_gitlab_project_webhooks(
        self,
        *,
        organization_id: int,
        integration_id: int,
    ) -> None:
        update_all_project_webhooks.delay(
            integration_id=integration_id,
            organization_id=organization_id,
        )
