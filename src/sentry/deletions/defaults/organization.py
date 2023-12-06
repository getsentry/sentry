from sentry.models.organization import OrganizationStatus
from sentry.services.hybrid_cloud.organization_actions.impl import (
    update_organization_with_outbox_message,
)

from ..base import ModelDeletionTask, ModelRelation


class OrganizationDeletionTask(ModelDeletionTask):
    def should_proceed(self, instance):
        """
        Only delete organizations that haven't been undeleted.
        """
        return instance.status in {
            OrganizationStatus.PENDING_DELETION,
            OrganizationStatus.DELETION_IN_PROGRESS,
        }

    def get_child_relations(self, instance):
        from sentry.deletions.defaults.discoversavedquery import DiscoverSavedQueryDeletionTask
        from sentry.discover.models import DiscoverSavedQuery, TeamKeyTransaction
        from sentry.incidents.models import AlertRule, Incident
        from sentry.models.artifactbundle import ArtifactBundle
        from sentry.models.commitauthor import CommitAuthor
        from sentry.models.dashboard import Dashboard
        from sentry.models.environment import Environment
        from sentry.models.integrations.external_issue import ExternalIssue
        from sentry.models.organizationmember import OrganizationMember
        from sentry.models.project import Project
        from sentry.models.promptsactivity import PromptsActivity
        from sentry.models.release import Release
        from sentry.models.repository import Repository
        from sentry.models.team import Team
        from sentry.models.transaction_threshold import ProjectTransactionThreshold

        # Team must come first
        relations = [ModelRelation(Team, {"organization_id": instance.id})]

        model_list = (
            OrganizationMember,
            Repository,
            CommitAuthor,
            Incident,
            AlertRule,
            Release,
            Project,
            Environment,
            Dashboard,
            TeamKeyTransaction,
            ExternalIssue,
            PromptsActivity,
            ProjectTransactionThreshold,
            ArtifactBundle,
        )
        relations.extend([ModelRelation(m, {"organization_id": instance.id}) for m in model_list])
        # Explicitly assign the task here as it was getting replaced with BulkModelDeletionTask in CI.
        relations.append(
            ModelRelation(
                DiscoverSavedQuery,
                {"organization_id": instance.id},
                task=DiscoverSavedQueryDeletionTask,
            )
        )

        return relations

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models.organization import OrganizationStatus

        for instance in instance_list:
            if instance.status != OrganizationStatus.DELETION_IN_PROGRESS:
                update_organization_with_outbox_message(
                    org_id=instance.id,
                    update_data={"status": OrganizationStatus.DELETION_IN_PROGRESS},
                )
