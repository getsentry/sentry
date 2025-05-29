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
from sentry.tasks.assemble import ChunkFileState
from sentry.testutils.cases import APITestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ProjectPreprodArtifactAssembleTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-assemble-preprod-artifact-files",
            args=[self.organization.slug, self.project.slug],
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

    def test_assemble_json_schema_optional_fields(self):
        checksum = sha1(b"test content").hexdigest()

        # Test with all optional fields
        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "file_name": "test.ipa",
                "sha": "abc123def456",
                "build_configuration": "release",
                "extras": {"version": "1.0.0", "platform": "ios"},
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content

        # Test with invalid extras field (not an object)
        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "extras": "invalid_string",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    @patch("sentry.tasks.assemble.assemble_preprod_artifact")
    def test_assemble_basic(self, mock_assemble_preprod_artifact):
        content = b"test preprod artifact content"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_preprod_artifact.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "file_name": None,
                "sha": None,
                "build_configuration": None,
                "extras": None,
            }
        )

    @patch("sentry.tasks.assemble.assemble_preprod_artifact")
    def test_assemble_with_metadata(self, mock_assemble_preprod_artifact):
        content = b"test preprod artifact with metadata"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "file_name": "MyApp.ipa",
                "sha": "abcdef123456",
                "build_configuration": "release",
                "extras": {"version": "2.1.0", "platform": "ios", "build_number": 42},
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()

        mock_assemble_preprod_artifact.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "file_name": "MyApp.ipa",
                "sha": "abcdef123456",
                "build_configuration": "release",
                "extras": {"version": "2.1.0", "platform": "ios", "build_number": 42},
            }
        )

    def test_assemble_with_missing_chunks(self):
        content = b"test content for missing chunks"
        total_checksum = sha1(content).hexdigest()

        # Try to upload with all the checksums missing
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
                "file_name": "test.apk",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert set(response.data["missingChunks"]) == {total_checksum}

        # Store the blobs into the database
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        # Make the request again after the file has been uploaded
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
                "file_name": "test.apk",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED

    def test_assemble_response(self):
        content = b"test response content"
        total_checksum = sha1(content).hexdigest()
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED

    def test_assemble_with_pending_deletion_project(self):
        # Create a project with pending deletion status
        self.project.status = ObjectStatus.PENDING_DELETION
        self.project.save()

        content = b"test content"
        total_checksum = sha1(content).hexdigest()
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        # Should return 404 since the project is pending deletion
        assert response.status_code == 404

    def test_assemble_org_auth_token(self):
        org2 = self.create_organization(owner=self.user)

        content = b"test org auth token content"
        total_checksum = sha1(content).hexdigest()
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

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
                "chunks": [blob.checksum],
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
                "chunks": [blob.checksum],
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
                scope_list=["project:releases"],
                date_last_used=None,
            )

        with outbox_runner():
            response = self.client.post(
                self.url,
                data={
                    "checksum": total_checksum,
                    "chunks": [blob.checksum],
                },
                HTTP_AUTHORIZATION=f"Bearer {good_token_str}",
            )
        assert response.status_code == 200

        # Make sure org token usage was updated
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_token = OrgAuthToken.objects.get(token_hashed=hash_token(good_token_str))
        assert org_token.date_last_used is not None
        assert org_token.project_last_used_id == self.project.id

    def test_poll_request(self):
        # Test poll request (no chunks provided)
        checksum = sha1(b"test poll").hexdigest()

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert response.data["missingChunks"] == []

    def test_check_existing_assembly_status(self):
        from sentry.tasks.assemble import AssembleTask, set_assemble_status

        checksum = sha1(b"test existing status").hexdigest()

        # Set a status manually
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, checksum, ChunkFileState.OK
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200
        assert response.data["state"] == ChunkFileState.OK
        assert response.data["missingChunks"] == []

    def test_permission_required(self):
        # Test without any authorization
        content = b"test permission content"
        total_checksum = sha1(content).hexdigest()

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [],
            },
        )

        assert response.status_code == 401
