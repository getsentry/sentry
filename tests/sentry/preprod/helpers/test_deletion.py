from sentry.preprod.helpers.deletion import _collect_snapshot_objectstore_keys
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison
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

    def test_collects_comparison_response_key(self) -> None:
        head_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        base_artifact = self.create_preprod_artifact(
            project=self.project,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            app_id="com.example.app",
        )
        head_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=head_artifact, image_count=0
        )
        base_metrics = self.create_preprod_snapshot_metrics(
            preprod_artifact=base_artifact, image_count=0
        )
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head_metrics,
            base_snapshot_metrics=base_metrics,
            state=PreprodSnapshotComparison.State.SUCCESS,
        )
        comparison.extras = {
            "comparison_key": f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}/comparison.json"
        }
        comparison.save(update_fields=["extras"])

        expected = (
            f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}"
            "/snapshot_comparison_response.json"
        )
        collected = {key for _, _, key in _collect_snapshot_objectstore_keys([head_artifact])}

        assert expected in collected
