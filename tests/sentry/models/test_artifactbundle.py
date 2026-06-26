from unittest import mock

from sentry.models.artifactbundle import delete_file_for_artifact_bundle
from sentry.models.files import File
from sentry.testutils.cases import TestCase


class ArtifactBundleTest(TestCase):
    @mock.patch("sentry.models.artifactbundle.delete_assemble_status")
    def test_delete_file_for_artifact_bundle_file_already_deleted(
        self, mock_delete_assemble_status
    ):
        file = self.create_file(name="test.js", type="artifact.bundle")
        bundle = self.create_artifact_bundle(
            org=self.organization,
            bundle_id="12345678-1234-1234-1234-123456789012",
            file=file,
            artifact_count=1,
        )

        # Pre-delete the file to simulate the race condition / bulk delete shared file
        file.delete()

        # The post_delete signal function should not raise File.DoesNotExist
        delete_file_for_artifact_bundle(bundle)

        assert mock_delete_assemble_status.call_count == 0

    @mock.patch("sentry.models.artifactbundle.delete_assemble_status")
    def test_delete_file_for_artifact_bundle_success(self, mock_delete_assemble_status):
        file = self.create_file(name="test.js", type="artifact.bundle")
        bundle = self.create_artifact_bundle(
            org=self.organization,
            bundle_id="12345678-1234-1234-1234-123456789012",
            file=file,
            artifact_count=1,
        )

        # Call the signal manually
        delete_file_for_artifact_bundle(bundle)

        assert mock_delete_assemble_status.call_count == 1
        # The file should be deleted by the signal
        assert not File.objects.filter(id=file.id).exists()
