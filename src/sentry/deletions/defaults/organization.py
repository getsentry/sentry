from __future__ import absolute_import, print_function

from ..base import ModelDeletionTask, ModelRelation


class OrganizationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import (
            OrganizationMember, Commit, CommitAuthor, CommitFileChange, Environment, Release,
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, Distribution, ReleaseHeadCommit,
            Repository, Team, Project
        )

        # Team must come first
        relations = [
            ModelRelation(Team, {'organization_id': instance.id}),
        ]

        model_list = (
            OrganizationMember, CommitFileChange, Commit, CommitAuthor, Environment, Repository,
            Release, ReleaseCommit, ReleaseEnvironment, ReleaseFile, Distribution,
            ReleaseHeadCommit, Project,
        )
        relations.extend([ModelRelation(m, {'organization_id': instance.id}) for m in model_list])

        return relations

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import OrganizationStatus

        for instance in instance_list:
            if instance.status != OrganizationStatus.DELETION_IN_PROGRESS:
                instance.update(status=OrganizationStatus.DELETION_IN_PROGRESS)
