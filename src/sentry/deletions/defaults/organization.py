from ..base import ModelDeletionTask, ModelRelation


class OrganizationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.discover.models import DiscoverSavedQuery, KeyTransaction, TeamKeyTransaction
        from sentry.incidents.models import AlertRule, Incident
        from sentry.models import (
            Commit,
            CommitAuthor,
            CommitFileChange,
            Dashboard,
            Distribution,
            Environment,
            ExternalIssue,
            OrganizationMember,
            Project,
            ProjectTransactionThreshold,
            PromptsActivity,
            PullRequest,
            Release,
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            ReleaseHeadCommit,
            Repository,
            Team,
        )

        # Team must come first
        relations = [ModelRelation(Team, {"organization_id": instance.id})]

        model_list = (
            OrganizationMember,
            CommitFileChange,
            Commit,
            PullRequest,
            CommitAuthor,
            Environment,
            Repository,
            Project,
            Release,  # Depends on Group deletions, a child of Project
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            Distribution,
            ReleaseHeadCommit,
            Dashboard,
            DiscoverSavedQuery,
            KeyTransaction,
            TeamKeyTransaction,
            ExternalIssue,
            PromptsActivity,
            Incident,
            AlertRule,
            ProjectTransactionThreshold,
        )
        relations.extend([ModelRelation(m, {"organization_id": instance.id}) for m in model_list])

        return relations

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import OrganizationStatus

        for instance in instance_list:
            if instance.status != OrganizationStatus.DELETION_IN_PROGRESS:
                instance.update(status=OrganizationStatus.DELETION_IN_PROGRESS)
