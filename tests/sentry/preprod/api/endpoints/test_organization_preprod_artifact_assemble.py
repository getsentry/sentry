from hashlib import sha1
from unittest.mock import patch

import orjson
from django.core.files.base import ContentFile
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.apitoken import ApiToken
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.fileblobowner import FileBlobOwner
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.preprod.api.endpoints.organization_preprod_artifact_assemble import (
    validate_preprod_artifact_schema,
)
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import AssembleTask, ChunkFileState, set_assemble_status
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ValidatePreprodArtifactSchemaTest(TestCase):
    """Unit tests for schema validation function - no database required."""

    def test_valid_minimal_schema(self):
        """Test valid minimal schema passes validation."""
        data = {"checksum": "a" * 40, "chunks": []}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert result == data

    def test_valid_full_schema(self):
        """Test valid schema with all optional fields passes validation."""
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40, "c" * 40],
            "git_sha": "d" * 40,
            "build_configuration": "release",
        }
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert result == data

    def test_invalid_json(self):
        """Test invalid JSON returns error."""
        body = b'{"invalid": json}'
        result, error = validate_preprod_artifact_schema(body)
        assert error == "Invalid json body"
        assert result == {}

    def test_missing_checksum(self):
        """Test missing checksum field returns error."""
        body = orjson.dumps({"chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "checksum" in error
        assert result == {}

    def test_invalid_checksum_format(self):
        """Test invalid checksum format returns error."""
        body = orjson.dumps({"checksum": "invalid", "chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "checksum" in error
        assert result == {}

    def test_checksum_wrong_type(self):
        """Test non-string checksum returns error."""
        body = orjson.dumps({"checksum": 123, "chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_missing_chunks(self):
        """Test missing chunks field returns error."""
        body = orjson.dumps({"checksum": "a" * 40})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "chunks" in error
        assert result == {}

    def test_chunks_wrong_type(self):
        """Test non-array chunks returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": "not_array"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_chunks_invalid_item_format(self):
        """Test invalid chunk format returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": ["invalid"]})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_chunks_invalid_item_type(self):
        """Test non-string chunk returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [123]})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_git_sha_wrong_type(self):
        """Test non-string git_sha returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "git_sha": 123})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_git_sha_invalid_format(self):
        """Test invalid git_sha format returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "git_sha": "invalid"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "git_sha" in error
        assert result == {}

    def test_build_configuration_wrong_type(self):
        """Test non-string build_configuration returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "build_configuration": 123})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_additional_properties_rejected(self):
        """Test additional properties are rejected."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "extra_field": "value"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}


class ProjectPreprodArtifactAssembleTest(APITestCase):
    """Integration tests for the full endpoint - requires database."""

    def setUp(self):
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.project = self.create_project()

        self.url = reverse(
            "sentry-api-0-assemble-preprod-artifact-files",
            args=[self.organization.slug, self.project.slug],
        )

        self.feature_context = Feature("organizations:preprod-artifact-assemble")
        self.feature_context.__enter__()

    def tearDown(self):
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def test_feature_flag_disabled_returns_403(self):
        """Test that endpoint returns 404 when feature flag is disabled."""
        self.feature_context.__exit__(None, None, None)

        try:
            content = b"test content"
            total_checksum = sha1(content).hexdigest()

            response = self.client.post(
                self.url,
                data={
                    "checksum": total_checksum,
                    "chunks": [],
                },
                HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            )
            assert response.status_code == 403
        finally:
            self.feature_context = Feature("organizations:preprod-artifact-assemble")
            self.feature_context.__enter__()

    def test_assemble_json_schema_integration(self):
        """Integration test for schema validation through the endpoint."""
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400

        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    def test_assemble_json_schema_invalid_structure(self):
        """Test that invalid JSON structure is rejected."""
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_missing_checksum(self):
        """Test that missing checksum field is rejected."""
        response = self.client.post(
            self.url, data={"chunks": []}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_invalid_checksum_format(self):
        """Test that invalid checksum format is rejected."""
        response = self.client.post(
            self.url,
            data={"checksum": "invalid", "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_checksum_wrong_type(self):
        """Test that non-string checksum is rejected."""
        response = self.client.post(
            self.url,
            data={"checksum": 123, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_missing_chunks(self):
        """Test that missing chunks field is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_chunks_wrong_type(self):
        """Test that non-array chunks field is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": "not_an_array"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_chunks_invalid_item_type(self):
        """Test that non-string items in chunks array are rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [123, 456]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_git_sha_wrong_type(self):
        """Test that non-string git_sha is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "git_sha": 123},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_git_sha_invalid_format(self):
        """Test that invalid git_sha format is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "git_sha": "invalid_sha"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_build_configuration_wrong_type(self):
        """Test that non-string build_configuration is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "build_configuration": 123},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_valid_minimal(self):
        """Test that valid minimal schema is accepted."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    def test_assemble_json_schema_optional_fields(self):
        checksum = sha1(b"test content").hexdigest()

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "git_sha": "c076e3b84d9d7c43f456908535ea78b9de6ec59b",
                "build_configuration": "release",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.assemble_preprod_artifact"
    )
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
                "git_sha": None,
                "build_configuration": None,
            }
        )

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.assemble_preprod_artifact"
    )
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
                "git_sha": "c076e3b84d9d7c43f456908535ea78b9de6ec59b",
                "build_configuration": "release",
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
                "git_sha": "c076e3b84d9d7c43f456908535ea78b9de6ec59b",
                "build_configuration": "release",
            }
        )

    def test_assemble_with_missing_chunks(self):
        content = b"test content for missing chunks"
        total_checksum = sha1(content).hexdigest()

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert set(response.data["missingChunks"]) == {total_checksum}

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [total_checksum],
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

        assert response.status_code == 404

    def test_assemble_org_auth_token(self):
        org2 = self.create_organization(owner=self.user)

        content = b"test org auth token content"
        total_checksum = sha1(content).hexdigest()
        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

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

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_token = OrgAuthToken.objects.get(token_hashed=hash_token(good_token_str))
        assert org_token.date_last_used is not None
        assert org_token.project_last_used_id == self.project.id

    def test_poll_request(self):
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
        checksum = sha1(b"test existing status").hexdigest()

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

    def test_integration_task_sets_status_api_can_read_it(self):
        """
        Integration test that verifies the task and API endpoint use consistent scope.

        This test reproduces the real workflow:
        1. Task assembles artifact and sets status with project_id scope
        2. API endpoint polls for status using project_id scope

        Both should use consistent project-level scope since preprod artifacts are project-specific.
        """
        content = b"test integration content"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum, ChunkFileState.OK
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [],
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200
        assert response.data["state"] == ChunkFileState.OK
        assert response.data["missingChunks"] == []

    def test_permission_required(self):
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
