from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models import ApiToken, FileBlob, FileBlobOwner
from sentry.tasks.assemble import ChunkFileState, assemble_artifacts
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationArtifactBundleAssembleTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-artifactbundle-assemble",
            args=[self.organization.slug],
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
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "projects": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "projects": [self.project.id]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "projects": [self.project.id],
                "version": "release/1",
                "dist": "android",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "projects": [self.project.id],
                "version": "",
                "dist": "android",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "projects": [self.project.id],
                "dist": "android",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "projects": [self.project.slug]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    def test_assemble_with_invalid_projects(self):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        # We want to test also with a project that has a status != VISIBLE.
        pending_deletion_project = self.create_project(status=ObjectStatus.PENDING_DELETION)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [pending_deletion_project.slug, "myslug", "anotherslug"],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 400, response.content
        assert response.data["error"] == "One or more projects are invalid"

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble_without_version_and_dist(self, mock_assemble_artifacts):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        # We test the endpoint without the release version.
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_ids": [self.project.id],
                "version": None,
                "dist": None,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
                "upload_as_artifact_bundle": True,
            }
        )

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble_with_version_and_no_dist(self, mock_assemble_artifacts):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        # We test the endpoint without the release version.
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
                "version": self.release.version,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_ids": [self.project.id],
                "version": self.release.version,
                "dist": None,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
                "upload_as_artifact_bundle": True,
            }
        )

    @patch("sentry.tasks.assemble.assemble_artifacts")
    def test_assemble_with_version_and_dist(self, mock_assemble_artifacts):
        dist = "android"
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        # We test the endpoint without the release version.
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
                "version": self.release.version,
                "dist": dist,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_artifacts.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_ids": [self.project.id],
                "version": self.release.version,
                "dist": dist,
                "chunks": [blob1.checksum],
                "checksum": total_checksum,
                "upload_as_artifact_bundle": True,
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
            upload_as_artifact_bundle=False,
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
            },
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
            upload_as_artifact_bundle=False,
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.ERROR
