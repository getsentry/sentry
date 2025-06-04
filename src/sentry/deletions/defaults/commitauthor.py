from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.commitauthor import CommitAuthor


class CommitAuthorDeletionTask(ModelDeletionTask[CommitAuthor]):
    def get_child_relations(self, instance: CommitAuthor) -> list[BaseRelation]:
        from sentry.models.commit import Commit

        return [
            ModelRelation(Commit, {"author_id": instance.id}),
        ]
