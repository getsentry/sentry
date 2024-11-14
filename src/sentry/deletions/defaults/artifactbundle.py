from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.artifactbundle import ArtifactBundle


class ArtifactBundleDeletionTask(ModelDeletionTask[ArtifactBundle]):
    def get_child_relations(self, instance: ArtifactBundle) -> list[BaseRelation]:
        from sentry.models.artifactbundle import (
            DebugIdArtifactBundle,
            ProjectArtifactBundle,
            ReleaseArtifactBundle,
        )

        return [
            ModelRelation(ReleaseArtifactBundle, {"artifact_bundle_id": instance.id}),
            ModelRelation(DebugIdArtifactBundle, {"artifact_bundle_id": instance.id}),
            ModelRelation(ProjectArtifactBundle, {"artifact_bundle_id": instance.id}),
        ]
