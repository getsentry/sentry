from __future__ import absolute_import

from sentry.utils.compat.mock import patch
from hashlib import sha1

from django.core.urlresolvers import reverse
from django.core.files.base import ContentFile

from sentry.models import ApiToken, FileBlob, FileBlobOwner
from sentry.testutils import APITestCase
from sentry.tasks.assemble import assemble_artifacts, ChunkFileState


class OrganizationReleaseAssembleTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.team = self.create_team(organization=self.organization)
        self.release = self.create_release(version="my-unique-release.1")
        self.url = reverse(
            "sentry-api-0-organization-release-assemble",
            args=[self.organization.slug, self.release.version],
        )

    def test_assemble_json_schema(self):
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token)
        )
        assert response.status_code == 400, response.content

        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": "invalid"},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble(self, mock_assemble_artifacts):
        bundle_file = self.create_artifact_bundle()
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization=self.organization, blob=blob1)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set([])

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "version": self.release.version,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
            }
        )

    def test_assemble_response(self):
        bundle_file = self.create_artifact_bundle()
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.OK

    def test_dif_error_response(self):
        bundle_file = b"invalid"
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.ERROR
