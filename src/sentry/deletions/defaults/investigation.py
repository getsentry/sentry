from __future__ import annotations

from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellDependency,
    InvestigationCellExecutionProject,
    InvestigationCellParameter,
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
            (InvestigationCellDependency, "cell__investigation_id"),
            (InvestigationCellParameter, "cell__investigation_id"),
            (InvestigationCellExecutionProject, "execution__cell__investigation_id"),
        )
        relations: list[BaseRelation] = [
            ModelRelation(model, {lookup: instance.id}, BulkModelDeletionTask)
            for model, lookup in bulk_relations
        ]

        relations.append(ModelRelation(InvestigationCell, {"investigation_id": instance.id}))
        relations.append(
            ModelRelation(
                InvestigationParameter, {"investigation_id": instance.id}, BulkModelDeletionTask
            )
        )

        return relations
