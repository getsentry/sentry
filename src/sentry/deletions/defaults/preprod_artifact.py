from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask
from sentry.preprod.models import PreprodArtifact


class PreprodArtifactDeletionTask(ModelDeletionTask[PreprodArtifact]):
    def delete_instance_bulk(self, instance_list: Sequence[PreprodArtifact]) -> None:
        from sentry.preprod.helpers.deletion import bulk_delete_artifacts_and_related_data

        artifact_ids = [instance.id for instance in instance_list]
        bulk_delete_artifacts_and_related_data(artifact_ids)

    def get_child_relations(self, instance: PreprodArtifact) -> list[BaseRelation]:
        return []
