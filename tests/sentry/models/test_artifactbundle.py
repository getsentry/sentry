from unittest import mock

from sentry.models.artifactbundle import delete_file_for_artifact_bundle
from sentry.models.files import File
from sentry.testutils.cases import TestCase


class ArtifactBundleTest(TestCase):
    @mock.patch("sentry.models.artifactbundle.delete_assemble_status")
    def test_delete_file_for_artifact_bundle_file_already_deleted(
    ):
        file = self.create_file(name="test.js", type="artifact.bundle")
        bundle = self.create_artifact_bundle(
            bundle_id="12345678-1234-1234-1234-123456789012",
            file=file,
        file_id = bundle.file_id
            artifact_count=1,
        )
        File.objects.filter(id=file_id).delete()

        # Reload the bundle so the file property is not cached
        bundle = ArtifactBundle.objects.get(id=bundle.id)
        # Pre-delete the file to simulate the race condition / bulk delete shared file
        file.delete()

        # The post_delete signal function should not raise File.DoesNotExist
        delete_file_for_artifact_bundle(bundle)

        assert mock_delete_assemble_status.call_count == 0

    def test_delete_file_for_artifact_bundle_success(self, mock_delete_assemble_status):
        file = self.create_file(name="test.js", type="artifact.bundle")
        bundle = self.create_artifact_bundle(
            bundle_id="12345678-1234-1234-1234-123456789012",
            file=file,
        file_id = bundle.file_id
            artifact_count=1,
        )

        # Call the signal manually
        delete_file_for_artifact_bundle(bundle)

        assert not File.objects.filter(id=file_id).exists()
        # The file should be deleted by the signal
        assert not File.objects.filter(id=file.id).exists()
