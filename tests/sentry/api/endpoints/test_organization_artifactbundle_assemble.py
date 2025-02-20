from hashlib import sha1
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.apitoken import ApiToken
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import ChunkFileState, assemble_artifacts
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class OrganizationArtifactBundleAssembleTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-artifactbundle-assemble",
            args=[self.organization.slug],
        )

    @with_feature("organizations:find-missing-chunks-new")
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

    @with_feature("organizations:find-missing-chunks-new")
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

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_with_valid_project_slugs(self):
        # Test with all valid project slugs
        valid_project = self.create_project()
        another_valid_project = self.create_project()

        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "projects": [valid_project.slug, another_valid_project.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        self.assertEqual(response.status_code, 200)

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_with_valid_project_ids(self):
        # Test with all valid project IDs
        valid_project = self.create_project()
        another_valid_project = self.create_project()

        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "projects": [str(valid_project.id), str(another_valid_project.id)],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        self.assertEqual(response.status_code, 200)

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_with_mix_of_slugs_and_ids(self):
        # Test with a mix of valid project slugs and IDs
        valid_project = self.create_project()
        another_valid_project = self.create_project()
        third_valid_project = self.create_project()

        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        blob = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "projects": [
                    valid_project.slug,
                    str(another_valid_project.id),
                    str(third_valid_project.id),
                ],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        self.assertEqual(response.status_code, 200)

    @with_feature("organizations:find-missing-chunks-new")
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

    @with_feature("organizations:find-missing-chunks-new")
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

    @with_feature("organizations:find-missing-chunks-new")
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

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_with_missing_chunks(self):
        dist = "android"
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()

        # We try to upload with all the checksums missing.
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
                "projects": [self.project.slug],
                "version": self.release.version,
                "dist": dist,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert set(response.data["missingChunks"]) == {total_checksum}

        # We store the blobs into the database.
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        # We make the request again after the file have been uploaded.
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
                "projects": [self.project.slug],
                "version": self.release.version,
                "dist": dist,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_response(self):
        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

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
        assert response.data["state"] == ChunkFileState.CREATED

    @with_feature("organizations:find-missing-chunks-new")
    def test_assemble_org_auth_token(self):
        org2 = self.create_organization(owner=self.user)

        bundle_file = self.create_artifact_bundle_zip(
            org=self.organization.slug, release=self.release.version
        )
        total_checksum = sha1(bundle_file).hexdigest()
        blob1 = FileBlob.from_file(ContentFile(bundle_file))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob1)

        assemble_artifacts(
            org_id=self.organization.id,
            version=self.release.version,
            checksum=total_checksum,
            chunks=[blob1.checksum],
            upload_as_artifact_bundle=False,
        )

        # right org, wrong permission level
        with assume_test_silo_mode(SiloMode.CONTROL):
            bad_token_str = generate_token(self.organization.slug, "")
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token 1",
                token_hashed=hash_token(bad_token_str),
                token_last_characters="ABCD",
                scope_list=[],
                date_last_used=None,
            )
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {bad_token_str}",
        )
        assert response.status_code == 403

        # wrong org, right permission level
        with assume_test_silo_mode(SiloMode.CONTROL):
            bad_org_token_str = generate_token(self.organization.slug, "")
            OrgAuthToken.objects.create(
                organization_id=org2.id,
                name="token 1",
                token_hashed=hash_token(bad_org_token_str),
                token_last_characters="ABCD",
                scope_list=[],
                date_last_used=None,
            )
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob1.checksum],
                "projects": [self.project.slug],
            },
            HTTP_AUTHORIZATION=f"Bearer {bad_org_token_str}",
        )
        assert response.status_code == 403

        # right org, right permission level
        with assume_test_silo_mode(SiloMode.CONTROL):
            good_token_str = generate_token(self.organization.slug, "")
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token 1",
                token_hashed=hash_token(good_token_str),
                token_last_characters="ABCD",
                scope_list=["org:ci"],
                date_last_used=None,
            )

        with outbox_runner():
            response = self.client.post(
                self.url,
                data={
                    "checksum": total_checksum,
                    "chunks": [blob1.checksum],
                    "projects": [self.project.slug],
                },
                HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
            )
        assert response.status_code == 200

        # Make sure org token usage was updated
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_token = OrgAuthToken.objects.get(token_hashed=hash_token(good_token_str))
        assert org_token.date_last_used is not None
        assert org_token.project_last_used_id == self.project.id
