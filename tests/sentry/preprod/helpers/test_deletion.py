from sentry.preprod.helpers.deletion import _collect_snapshot_objectstore_keys
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import TestCase


class CollectSnapshotObjectstoreKeysTest(TestCase):
    def test_collects_manifest_and_head_images_keys(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        manifest_key = f"{self.organization.id}/{self.project.id}/{artifact.id}/manifest.json"
        head_images_key = (
            f"{self.organization.id}/{self.project.id}/{artifact.id}/snapshot_head_images.json"
        )
        metrics = self.create_preprod_snapshot_metrics(preprod_artifact=artifact, image_count=0)
        metrics.extras = {"manifest_key": manifest_key, "head_images_key": head_images_key}
        metrics.save(update_fields=["extras"])

        collected = {key for _, _, key in _collect_snapshot_objectstore_keys([artifact])}

        assert manifest_key in collected
        assert head_images_key in collected
