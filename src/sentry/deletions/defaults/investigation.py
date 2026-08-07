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
    InvestigationBlockExecutionProject,
    InvestigationBlockParameter,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationProject,
)


class InvestigationDeletionTask(ModelDeletionTask[Investigation]):
    mark_in_progress_default = False

    def get_child_relations(self, instance: Investigation) -> list[BaseRelation]:
        bulk_relations = (
            (InvestigationProject, "investigation_id"),
            (InvestigationFavoriteUser, "investigation_id"),
            (InvestigationBlockDependency, "block__investigation_id"),
            (InvestigationBlockParameter, "block__investigation_id"),
            (InvestigationBlockExecutionProject, "execution__block__investigation_id"),
        )
        relations: list[BaseRelation] = [
            ModelRelation(model, {lookup: instance.id}, BulkModelDeletionTask)
            for model, lookup in bulk_relations
        ]

        relations.append(ModelRelation(InvestigationBlock, {"investigation_id": instance.id}))
        relations.append(
            ModelRelation(
                InvestigationParameter, {"investigation_id": instance.id}, BulkModelDeletionTask
            )
        )

        return relations
