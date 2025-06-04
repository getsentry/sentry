from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.commit import Commit


class CommitDeletionTask(ModelDeletionTask[Commit]):
    def get_child_relations(self, instance: Commit) -> list[BaseRelation]:
        from sentry.models.commitfilechange import CommitFileChange
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        return [
            ModelRelation(CommitFileChange, {"commit_id": instance.id}),
            ModelRelation(ReleaseCommit, {"commit_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"commit_id": instance.id}),
        ]
