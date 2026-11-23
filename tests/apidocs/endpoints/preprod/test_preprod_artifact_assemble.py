from hashlib import sha1
from unittest.mock import MagicMock, patch

from django.core.files.base import ContentFile
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.preprod.tasks import create_preprod_artifact

ENDPOINT_MODULE = "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble"


class ProjectPreprodArtifactAssembleDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse(
            "sentry-api-0-assemble-preprod-artifact-files",
            args=[self.organization.slug, self.project.slug],
        )
        self.login_as(user=self.user)

    def test_post_missing_chunks(self) -> None:
        checksum = sha1(b"missing").hexdigest()
        data = {"checksum": checksum, "chunks": [checksum]}
        response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(self.url, data, content_type="application/json")

        assert response.data["missingChunks"] == [checksum]
        self.validate_schema(request, response)

    @patch(f"{ENDPOINT_MODULE}.assemble_preprod_artifact")
    @patch(f"{ENDPOINT_MODULE}.create_preprod_artifact")
    def test_post_created(
        self, mock_create_preprod_artifact: MagicMock, mock_assemble: MagicMock
    ) -> None:
        content = b"apidocs preprod artifact"
        checksum = sha1(content).hexdigest()
        mock_create_preprod_artifact.return_value = create_preprod_artifact(
            org_id=self.organization.id, project_id=self.project.id, checksum=checksum
        )
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        data = {"checksum": checksum, "chunks": [blob.checksum]}
        response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(self.url, data, content_type="application/json")

        assert "artifactUrl" in response.data
        self.validate_schema(request, response)
