from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.silo import SiloMode
from sentry.tasks.assemble import ChunkFileState, assemble_artifacts
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationReleaseAssembleTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.team = self.create_team(organization=self.organization)
        self.release = self.create_release(version="my-unique-release.1")
        self.url = reverse(
            "sentry-api-0-organization-release-assemble",
            args=[self.organization.slug, self.release.version],
        )

    def test_assemble_json_schema(self):
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": "invalid"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble(self, mock_assemble_artifacts):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "version": self.release.version,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
                "project_ids": [self.project.id],
                "upload_as_artifact_bundle": True,
                "is_release_bundle_migration": True,
            }
        )

    def test_assemble_response(self):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            project_ids=[self.project.id],
            upload_as_artifact_bundle=True,
            is_release_bundle_migration=True,
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
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
            project_ids=[self.project.id],
            upload_as_artifact_bundle=True,
            is_release_bundle_migration=True,
        )

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.ERROR

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble_as_artifact_bundle(self, mock_assemble_artifacts):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        # assert that we are uploading as artifact bundle
        kwargs = {
            "org_id": self.organization.id,
            "version": self.release.version,
            "checksum": total_checksum,
            "chunks": [blob1.checksum],
            "project_ids": [self.project.id],
            "upload_as_artifact_bundle": True,
            "is_release_bundle_migration": True,
        }
        mock_assemble_artifacts.apply_async.assert_called_once_with(kwargs=kwargs)
        # actually call through to assemble :-)
        assemble_artifacts(**kwargs)

        response = self.client.post(
            self.url,
            data={"checksum": total_checksum, "chunks": [blob1.checksum]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.OK

        # make sure that we have an artifact bundle now
        artifact_bundles = ArtifactBundle.objects.filter(
            organization_id=self.organization.id,
        )
        assert len(artifact_bundles) == 1
