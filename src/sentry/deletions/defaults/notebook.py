from __future__ import annotations

from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockExecutionProject,
    NotebookComment,
    NotebookFavoriteUser,
    NotebookProject,
    NotebookSeen,
)


class NotebookBlockExecutionDeletionTask(ModelDeletionTask[NotebookBlockExecution]):
    mark_in_progress_default = False

    def get_child_relations(self, instance: NotebookBlockExecution) -> list[BaseRelation]:
        return [
            ModelRelation(
                NotebookBlockExecutionProject,
                {"execution_id": instance.id},
                BulkModelDeletionTask,
            ),
        ]


class NotebookBlockDeletionTask(ModelDeletionTask[NotebookBlock]):
    def get_child_relations(self, instance: NotebookBlock) -> list[BaseRelation]:
        return [
            ModelRelation(NotebookComment, {"block_id": instance.id}, BulkModelDeletionTask),
            ModelRelation(NotebookBlockExecution, {"block_id": instance.id}),
        ]


class NotebookDeletionTask(ModelDeletionTask[Notebook]):
    mark_in_progress_default = False

    def get_child_relations(self, instance: Notebook) -> list[BaseRelation]:
        return [
            ModelRelation(NotebookProject, {"notebook_id": instance.id}, BulkModelDeletionTask),
            ModelRelation(
                NotebookFavoriteUser, {"notebook_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(NotebookSeen, {"notebook_id": instance.id}, BulkModelDeletionTask),
            ModelRelation(NotebookComment, {"notebook_id": instance.id}, BulkModelDeletionTask),
            ModelRelation(
                NotebookActionRequest, {"notebook_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(NotebookBlock, {"notebook_id": instance.id}),
        ]
