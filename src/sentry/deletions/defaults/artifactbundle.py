from ..base import ModelDeletionTask, ModelRelation


class ArtifactBundleDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
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
