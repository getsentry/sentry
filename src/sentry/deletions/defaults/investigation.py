from __future__ import annotations

from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockDependency,
    InvestigationBlockExecution,
    InvestigationBlockExecutionProject,
    InvestigationBlockParameter,
    InvestigationComment,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationProject,
    InvestigationSeen,
)


class InvestigationBlockExecutionDeletionTask(ModelDeletionTask[InvestigationBlockExecution]):
    mark_in_progress_default = False

    def get_child_relations(self, instance: InvestigationBlockExecution) -> list[BaseRelation]:
        return [
            ModelRelation(
                InvestigationBlockExecutionProject,
                {"execution_id": instance.id},
                BulkModelDeletionTask,
            ),
        ]


class InvestigationBlockDeletionTask(ModelDeletionTask[InvestigationBlock]):
    def get_child_relations(self, instance: InvestigationBlock) -> list[BaseRelation]:
        return [
            ModelRelation(InvestigationComment, {"block_id": instance.id}, BulkModelDeletionTask),
            ModelRelation(
                InvestigationBlockDependency, {"block_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(
                InvestigationBlockDependency, {"depends_on_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(
                InvestigationBlockParameter, {"block_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(InvestigationBlockExecution, {"block_id": instance.id}),
        ]


class InvestigationDeletionTask(ModelDeletionTask[Investigation]):
    mark_in_progress_default = False

    def get_child_relations(self, instance: Investigation) -> list[BaseRelation]:
        return [
            ModelRelation(
                InvestigationProject, {"investigation_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(
                InvestigationFavoriteUser, {"investigation_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(
                InvestigationSeen, {"investigation_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(
                InvestigationComment, {"investigation_id": instance.id}, BulkModelDeletionTask
            ),
            ModelRelation(InvestigationBlock, {"investigation_id": instance.id}),
            ModelRelation(
                InvestigationParameter, {"investigation_id": instance.id}, BulkModelDeletionTask
            ),
        ]
