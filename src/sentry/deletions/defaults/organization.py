from collections.abc import Sequence

from django.db import router

from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.models.environment import Environment
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.organization import Organization, OrganizationStatus
from sentry.organizations.services.organization_actions.impl import (
    update_organization_with_outbox_message,
)
from sentry.silo.safety import unguarded_write
from sentry.utils.query import bulk_delete_objects


class OrganizationDeletionTask(ModelDeletionTask[Organization]):
    def should_proceed(self, instance: Organization) -> bool:
        """
        Only delete organizations that haven't been undeleted.
        """
        return instance.status in {
            OrganizationStatus.PENDING_DELETION,
            OrganizationStatus.DELETION_IN_PROGRESS,
        }

    def get_child_relations(self, instance: Organization) -> list[BaseRelation]:
        from sentry.deletions.defaults.discoversavedquery import DiscoverSavedQueryDeletionTask
        from sentry.discover.models import DiscoverSavedQuery, TeamKeyTransaction
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.incidents.models.incident import Incident
        from sentry.integrations.models.external_issue import ExternalIssue
        from sentry.models.artifactbundle import ArtifactBundle
        from sentry.models.commitauthor import CommitAuthor
        from sentry.models.dashboard import Dashboard
        from sentry.models.organizationmember import OrganizationMember
        from sentry.models.project import Project
        from sentry.models.promptsactivity import PromptsActivity
        from sentry.models.release import Release
        from sentry.models.repository import Repository
        from sentry.models.team import Team
        from sentry.models.transaction_threshold import ProjectTransactionThreshold
        from sentry.workflow_engine.models import Workflow

        # Team must come first
        relations: list[BaseRelation] = [ModelRelation(Team, {"organization_id": instance.id})]

        pre_environment_models = (
            OrganizationMember,
            Repository,
            CommitAuthor,
            Incident,
            AlertRule,
            Release,
            Project,
            Workflow,
        )
        relations.extend(
            [ModelRelation(m, {"organization_id": instance.id}) for m in pre_environment_models]
        )

        # GroupEnvironment must be deleted before Environment. When Environment is deleted
        # via the ORM, Django cascades to GroupEnvironment (on_delete=CASCADE, db_constraint=False)
        # and fires a post_delete signal per row. For large orgs this causes the deletion task
        # to time out. Bulk-deleting GroupEnvironment first avoids that cascade entirely.
        relations.append(
            ModelRelation(
                GroupEnvironment,
                {"environment__organization_id": instance.id},
                task=GroupEnvironmentBulkDeletionTask,
            )
        )

        post_environment_models = (
            Environment,
            Dashboard,
            TeamKeyTransaction,
            ExternalIssue,
            PromptsActivity,
            ProjectTransactionThreshold,
            ArtifactBundle,
        )
        relations.extend(
            [ModelRelation(m, {"organization_id": instance.id}) for m in post_environment_models]
        )
        # Explicitly assign the task here as it was getting replaced with BulkModelDeletionTask in CI.
        relations.append(
            ModelRelation(
                DiscoverSavedQuery,
                {"organization_id": instance.id},
                task=DiscoverSavedQueryDeletionTask,
            )
        )

        return relations

    def mark_deletion_in_progress(self, instance_list: Sequence[Organization]) -> None:
        from sentry.models.organization import OrganizationStatus

        for instance in instance_list:
            if instance.status != OrganizationStatus.DELETION_IN_PROGRESS:
                update_organization_with_outbox_message(
                    org_id=instance.id,
                    update_data={"status": OrganizationStatus.DELETION_IN_PROGRESS},
                )


class GroupEnvironmentBulkDeletionTask(BulkModelDeletionTask[GroupEnvironment]):
    """
    Deletes GroupEnvironment rows by resolving environment IDs first to avoid
    a cross-table JOIN that times out for large orgs. Pages through environment
    IDs in batches to stay under PostgreSQL's 32k placeholder limit.
    """

    ENV_ID_BATCH_SIZE = 10_000
    _last_env_id = 0

    def _delete_instance_bulk(self) -> bool:
        org_id = self.query["environment__organization_id"]

        env_ids = list(
            Environment.objects.filter(organization_id=org_id, id__gt=self._last_env_id)
            .order_by("id")
            .values_list("id", flat=True)[: self.ENV_ID_BATCH_SIZE]
        )
        if not env_ids:
            self._last_env_id = 0
            return False

        try:
            with unguarded_write(using=router.db_for_write(self.model)):
                has_more_rows = bulk_delete_objects(
                    model=self.model,
                    limit=self.chunk_size,
                    transaction_id=self.transaction_id,
                    environment_id__in=env_ids,
                )
        finally:
            model_name = self.model.__name__
            self.logger.info(
                f"object.delete.bulk_executed ({model_name})",
                extra={
                    "transaction_id": self.transaction_id,
                    "app_label": self.model._meta.app_label,
                    "model": model_name,
                    **self.query,
                },
            )

        if not has_more_rows:
            self._last_env_id = env_ids[-1]

        return True
