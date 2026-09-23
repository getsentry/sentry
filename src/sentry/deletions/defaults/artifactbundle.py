from collections.abc import Sequence

from sentry.deletions.base import (
    BaseRelation,
    BulkModelDeletionTask,
    ModelDeletionTask,
    ModelRelation,
)
from sentry.models.artifactbundle import ArtifactBundle


class ArtifactBundleDeletionTask(ModelDeletionTask[ArtifactBundle]):
    def get_child_relations_bulk(
        self, instance_list: Sequence[ArtifactBundle]
    ) -> list[BaseRelation]:
        from sentry.models.artifactbundle import (
            DebugIdArtifactBundle,
            ProjectArtifactBundle,
            ReleaseArtifactBundle,
        )

        # The child tables are leaves without delete signals, so raw bulk deletes are safe.
        # A bundle can own many debug IDs, and per-row deletes made cleanup very slow.
        query = {"artifact_bundle_id__in": [i.id for i in instance_list]}
        return [
            ModelRelation(model, query, BulkModelDeletionTask)
            for model in (ReleaseArtifactBundle, DebugIdArtifactBundle, ProjectArtifactBundle)
        ]
