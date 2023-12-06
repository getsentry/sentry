from ..base import ModelDeletionTask, ModelRelation


class CommitDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.commitfilechange import CommitFileChange
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        return [
            ModelRelation(CommitFileChange, {"commit_id": instance.id}),
            ModelRelation(ReleaseCommit, {"commit_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"commit_id": instance.id}),
        ]
