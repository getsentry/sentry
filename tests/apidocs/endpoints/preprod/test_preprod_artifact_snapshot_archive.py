from unittest.mock import MagicMock, patch

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics

ENDPOINT_MODULE = "sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot_archive"


class OrganizationPreprodSnapshotArchiveDocs(APIDocsTestCase):
    def setUp(self) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project, state=PreprodArtifact.ArtifactState.PROCESSED
        )
        PreprodSnapshotMetrics.objects.create(
            preprod_artifact=artifact, image_count=1, extras={"manifest_key": "k"}
        )
        self.url = reverse(
            "sentry-api-0-organization-preprod-snapshots-archive",
            args=[self.organization.slug, artifact.id],
        )
        self.login_as(user=self.user)

    @patch(f"{ENDPOINT_MODULE}.get_snapshot_storage")
    def test_get(self, mock_storage: MagicMock) -> None:
        mock_storage.return_value = MagicMock()
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        assert response.data == {"ready": True}
        self.validate_schema(request, response)

    @patch(f"{ENDPOINT_MODULE}.build_snapshot_images_zip")
    def test_post(self, mock_task: MagicMock) -> None:
        response = self.client.post(self.url)
        request = RequestFactory().post(self.url)

        assert response.status_code == 202
        self.validate_schema(request, response)
