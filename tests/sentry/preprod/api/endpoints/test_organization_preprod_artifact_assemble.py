from hashlib import sha1
from unittest.mock import MagicMock, patch

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
    validate_vcs_parameters,
)
from sentry.preprod.tasks import create_preprod_artifact
from sentry.silo.base import SiloMode
from sentry.tasks.assemble import AssembleTask, ChunkFileState, set_assemble_status
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import Feature
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ValidatePreprodArtifactSchemaTest(TestCase):
    """Unit tests for schema validation function - no database required."""

    def test_valid_minimal_schema(self) -> None:
        """Test valid minimal schema passes validation."""
        data = {"checksum": "a" * 40, "chunks": []}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert result == data

    def test_valid_full_schema(self) -> None:
        """Test valid schema with all optional fields passes validation."""
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40, "c" * 40],
            "build_configuration": "release",
            "head_sha": "e" * 40,
            "base_sha": "f" * 40,
            "provider": "github",
            "head_repo_name": "owner/repo",
            "base_repo_name": "owner/repo",
            "head_ref": "feature/xyz",
            "base_ref": "main",
            "pr_number": 123,
        }
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert result == data

    def test_valid_schema_with_commit_comparison(self) -> None:
        """Test valid schema with CommitComparison fields passes validation."""
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40, "c" * 40],
            "build_configuration": "release",
            "head_sha": "e" * 40,
            "base_sha": "f" * 40,
            "provider": "github",
            "head_repo_name": "owner/repo",
            "base_repo_name": "owner/repo",
            "head_ref": "feature/xyz",
            "base_ref": "main",
            "pr_number": 123,
        }
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert result == data

    def test_invalid_json(self) -> None:
        """Test invalid JSON returns error."""
        body = b'{"invalid": json}'
        result, error = validate_preprod_artifact_schema(body)
        assert error == "Invalid json body"
        assert result == {}

    def test_missing_checksum(self) -> None:
        """Test missing checksum field returns error."""
        body = orjson.dumps({"chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "checksum" in error
        assert result == {}

    def test_invalid_checksum_format(self) -> None:
        """Test invalid checksum format returns error."""
        body = orjson.dumps({"checksum": "invalid", "chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "checksum" in error
        assert result == {}

    def test_checksum_wrong_type(self) -> None:
        """Test non-string checksum returns error."""
        body = orjson.dumps({"checksum": 123, "chunks": []})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_missing_chunks(self) -> None:
        """Test missing chunks field returns error."""
        body = orjson.dumps({"checksum": "a" * 40})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "chunks" in error
        assert result == {}

    def test_chunks_wrong_type(self) -> None:
        """Test non-array chunks returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": "not_array"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_chunks_invalid_item_format(self) -> None:
        """Test invalid chunk format returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": ["invalid"]})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_chunks_invalid_item_type(self) -> None:
        """Test non-string chunk returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [123]})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_build_configuration_wrong_type(self) -> None:
        """Test non-string build_configuration returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "build_configuration": 123})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_head_sha_invalid_format(self) -> None:
        """Test invalid head_sha format returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "head_sha": "invalid"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "head_sha" in error
        assert result == {}

    def test_base_sha_invalid_format(self) -> None:
        """Test invalid base_sha format returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "base_sha": "invalid"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert "base_sha" in error
        assert result == {}

    def test_pr_number_invalid(self) -> None:
        """Test invalid pr_number returns error."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "pr_number": 0})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_additional_properties_rejected(self) -> None:
        """Test additional properties are rejected."""
        body = orjson.dumps({"checksum": "a" * 40, "chunks": [], "extra_field": "value"})
        result, error = validate_preprod_artifact_schema(body)
        assert error is not None
        assert result == {}

    def test_empty_string_head_sha_filtered_out(self) -> None:
        """Test empty string for head_sha is accepted and filtered out."""
        data = {"checksum": "a" * 40, "chunks": [], "head_sha": ""}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert "head_sha" not in result
        assert result == {"checksum": "a" * 40, "chunks": []}

    def test_empty_string_base_sha_filtered_out(self) -> None:
        """Test empty string for base_sha is accepted and filtered out."""
        data = {"checksum": "a" * 40, "chunks": [], "base_sha": ""}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert "base_sha" not in result
        assert result == {"checksum": "a" * 40, "chunks": []}

    def test_empty_string_provider_filtered_out(self) -> None:
        """Test empty string for provider is accepted and filtered out."""
        data = {"checksum": "a" * 40, "chunks": [], "provider": ""}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert "provider" not in result
        assert result == {"checksum": "a" * 40, "chunks": []}

    def test_empty_string_head_ref_filtered_out(self) -> None:
        """Test empty string for head_ref is accepted and filtered out."""
        data = {"checksum": "a" * 40, "chunks": [], "head_ref": ""}
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert "head_ref" not in result
        assert result == {"checksum": "a" * 40, "chunks": []}

    def test_empty_strings_with_valid_data_filtered_out(self) -> None:
        """Test empty strings are filtered out while keeping valid data."""
        data = {
            "checksum": "a" * 40,
            "chunks": ["b" * 40],
            "head_sha": "",
            "provider": "",
            "head_ref": "feature/xyz",
            "build_configuration": "debug",
        }
        body = orjson.dumps(data)
        result, error = validate_preprod_artifact_schema(body)
        assert error is None
        assert "head_sha" not in result
        assert "provider" not in result
        assert result == {
            "checksum": "a" * 40,
            "chunks": ["b" * 40],
            "head_ref": "feature/xyz",
            "build_configuration": "debug",
        }


class ValidateVcsParametersTest(TestCase):
    """Unit tests for VCS parameter validation function - no database required."""

    def test_valid_minimal_no_vcs_params(self) -> None:
        """Test that validation passes when no VCS params are provided."""
        data = {"checksum": "a" * 40, "chunks": []}
        error = validate_vcs_parameters(data)
        assert error is None

    def test_valid_complete_vcs_params(self) -> None:
        """Test that validation passes when all required VCS params are provided."""
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": "e" * 40,
            "head_repo_name": "owner/repo",
            "provider": "github",
            "head_ref": "feature/xyz",
        }
        error = validate_vcs_parameters(data)
        assert error is None

    def test_valid_complete_vcs_params_with_base_sha(self) -> None:
        """Test that validation passes when all VCS params including base_sha are provided."""
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": "e" * 40,
            "base_sha": "f" * 40,
            "head_repo_name": "owner/repo",
            "provider": "github",
            "head_ref": "feature/xyz",
        }
        error = validate_vcs_parameters(data)
        assert error is None

    def test_same_head_and_base_sha(self) -> None:
        """Test that validation fails when head_sha and base_sha are the same."""
        same_sha = "e" * 40
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": same_sha,
            "base_sha": same_sha,
        }
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Head SHA and base SHA cannot be the same" in error
        assert same_sha in error

    def test_base_sha_without_head_sha(self) -> None:
        """Test that validation fails when base_sha is provided without head_sha."""
        data = {"checksum": "a" * 40, "chunks": [], "base_sha": "f" * 40}
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Head SHA is required when base SHA is provided" in error

    def test_missing_head_repo_name(self) -> None:
        """Test that validation fails when head_repo_name is missing."""
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": "e" * 40,
            "provider": "github",
            "head_ref": "feature/xyz",
        }
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Missing parameters" in error
        assert "head_repo_name" in error

    def test_missing_provider(self) -> None:
        """Test that validation fails when provider is missing."""
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": "e" * 40,
            "head_repo_name": "owner/repo",
            "head_ref": "feature/xyz",
        }
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Missing parameters" in error
        assert "provider" in error

    def test_missing_head_ref(self) -> None:
        """Test that validation fails when head_ref is missing."""
        data = {
            "checksum": "a" * 40,
            "chunks": [],
            "head_sha": "e" * 40,
            "head_repo_name": "owner/repo",
            "provider": "github",
        }
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Missing parameters" in error
        assert "head_ref" in error

    def test_missing_multiple_params(self) -> None:
        """Test that validation fails and reports all missing params."""
        data = {"checksum": "a" * 40, "chunks": [], "head_sha": "e" * 40}
        error = validate_vcs_parameters(data)
        assert error is not None
        assert "Missing parameters" in error
        assert "head_repo_name" in error
        assert "provider" in error
        assert "head_ref" in error


class ProjectPreprodArtifactAssembleTest(APITestCase):
    """Integration tests for the full endpoint - requires database."""

    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.token = ApiToken.objects.create(user=self.user, scope_list=["project:write"])
        self.project = self.create_project()

        self.url = reverse(
            "sentry-api-0-assemble-preprod-artifact-files",
            args=[self.organization.slug, self.project.slug],
        )

        self.feature_context = Feature("organizations:preprod-frontend-routes")
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def test_feature_flag_disabled_returns_403(self) -> None:
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
            self.feature_context = Feature("organizations:preprod-frontend-routes")
            self.feature_context.__enter__()

    def test_assemble_json_schema_integration(self) -> None:
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

    def test_assemble_json_schema_invalid_structure(self) -> None:
        """Test that invalid JSON structure is rejected."""
        response = self.client.post(
            self.url, data={"lol": "test"}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_invalid_provider(self) -> None:
        """Test that invalid provider is rejected."""
        response = self.client.post(
            self.url,
            data={"checksum": "a" * 40, "chunks": [], "provider": "invalid"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content
        assert "Unsupported VCS provider 'invalid'" in response.data["error"]
        assert "Supported providers are:" in response.data["error"]
        assert "github" in response.data["error"]

    def test_assemble_json_schema_missing_checksum(self) -> None:
        """Test that missing checksum field is rejected."""
        response = self.client.post(
            self.url, data={"chunks": []}, HTTP_AUTHORIZATION=f"Bearer {self.token.token}"
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_invalid_checksum_format(self) -> None:
        """Test that invalid checksum format is rejected."""
        response = self.client.post(
            self.url,
            data={"checksum": "invalid", "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_checksum_wrong_type(self) -> None:
        """Test that non-string checksum is rejected."""
        response = self.client.post(
            self.url,
            data={"checksum": 123, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_missing_chunks(self) -> None:
        """Test that missing chunks field is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_chunks_wrong_type(self) -> None:
        """Test that non-array chunks field is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": "not_an_array"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_chunks_invalid_item_type(self) -> None:
        """Test that non-string items in chunks array are rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [123, 456]},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_build_configuration_wrong_type(self) -> None:
        """Test that non-string build_configuration is rejected."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": [], "build_configuration": 123},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content

    def test_assemble_json_schema_valid_minimal(self) -> None:
        """Test that valid minimal schema is accepted."""
        checksum = sha1(b"1").hexdigest()
        response = self.client.post(
            self.url,
            data={"checksum": checksum, "chunks": []},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.NOT_FOUND

    def test_assemble_json_schema_optional_fields(self) -> None:
        checksum = sha1(b"test content").hexdigest()

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],
                "build_configuration": "release",
                "head_sha": "e" * 40,
                "base_sha": "f" * 40,
                "provider": "github",
                "head_repo_name": "owner/repo",
                "base_repo_name": "owner/repo",
                "head_ref": "feature/xyz",
                "base_ref": "main",
                "pr_number": 123,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.assemble_preprod_artifact"
    )
    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.create_preprod_artifact"
    )
    def test_assemble_basic(
        self, mock_create_preprod_artifact: MagicMock, mock_assemble_preprod_artifact: MagicMock
    ) -> None:
        content = b"test preprod artifact content"
        total_checksum = sha1(content).hexdigest()
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None
        artifact_id = artifact.id

        mock_create_preprod_artifact.return_value = artifact

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
        expected_url = (
            f"/organizations/{self.organization.slug}/preprod/{self.project.slug}/{artifact_id}"
        )
        assert expected_url in response.data["artifactUrl"]

        mock_create_preprod_artifact.assert_called_once_with(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration_name=None,
            release_notes=None,
            head_sha=None,
            base_sha=None,
            provider=None,
            head_repo_name=None,
            base_repo_name=None,
            head_ref=None,
            base_ref=None,
            pr_number=None,
        )

        mock_assemble_preprod_artifact.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "artifact_id": artifact_id,
                "build_configuration": None,
            }
        )

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.assemble_preprod_artifact"
    )
    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.create_preprod_artifact"
    )
    def test_assemble_with_metadata(
        self, mock_create_preprod_artifact: MagicMock, mock_assemble_preprod_artifact: MagicMock
    ) -> None:
        content = b"test preprod artifact with metadata"
        total_checksum = sha1(content).hexdigest()
        artifact = create_preprod_artifact(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
        )
        assert artifact is not None
        artifact_id = artifact.id

        mock_create_preprod_artifact.return_value = artifact

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "build_configuration": "release",
                "head_sha": "e" * 40,
                "base_sha": "f" * 40,
                "provider": "github",
                "head_repo_name": "owner/repo",
                "base_repo_name": "owner/repo",
                "head_ref": "feature/xyz",
                "base_ref": "main",
                "pr_number": 123,
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 200, response.content
        assert response.data["state"] == ChunkFileState.CREATED
        assert set(response.data["missingChunks"]) == set()
        expected_url = (
            f"/organizations/{self.organization.slug}/preprod/{self.project.slug}/{artifact_id}"
        )
        assert expected_url in response.data["artifactUrl"]

        mock_create_preprod_artifact.assert_called_once_with(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration_name="release",
            release_notes=None,
            head_sha="e" * 40,
            base_sha="f" * 40,
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        mock_assemble_preprod_artifact.apply_async.assert_called_once_with(
            kwargs={
                "org_id": self.organization.id,
                "project_id": self.project.id,
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "artifact_id": artifact_id,
                "build_configuration": "release",
            }
        )

    def test_assemble_with_missing_chunks(self) -> None:
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

    def test_assemble_response(self) -> None:
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

    def test_assemble_with_pending_deletion_project(self) -> None:
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

    def test_assemble_org_auth_token(self) -> None:
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

    def test_poll_request(self) -> None:
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

    def test_check_existing_assembly_status(self) -> None:
        """Test that endpoint doesn't check existing assembly status - it processes new requests."""
        checksum = sha1(b"test existing status").hexdigest()

        # Even if assembly status exists, endpoint doesn't check it
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, checksum, ChunkFileState.CREATED
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": checksum,
                "chunks": [],  # No chunks means NOT_FOUND
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200
        # Endpoint returns NOT_FOUND when no chunks are provided, regardless of existing status
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert response.data["missingChunks"] == []

    def test_integration_task_sets_status_api_can_read_it(self) -> None:
        """
        Test showing that this endpoint doesn't poll for status - it only processes new assembly requests.

        This endpoint doesn't check existing assembly status. Instead, it:
        1. Checks for missing chunks
        2. Creates artifacts and queues assembly tasks
        3. Returns NOT_FOUND when no chunks are provided
        """
        content = b"test integration content"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        # Even if task sets status, this endpoint doesn't read it
        set_assemble_status(
            AssembleTask.PREPROD_ARTIFACT, self.project.id, total_checksum, ChunkFileState.CREATED
        )

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [],  # No chunks means NOT_FOUND
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )

        assert response.status_code == 200
        # Endpoint doesn't check existing status, returns NOT_FOUND for empty chunks
        assert response.data["state"] == ChunkFileState.NOT_FOUND
        assert response.data["missingChunks"] == []

    def test_permission_required(self) -> None:
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

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_artifact_assemble.create_preprod_artifact"
    )
    def test_assemble_create_artifact_failure(
        self, mock_create_preprod_artifact: MagicMock
    ) -> None:
        """Test that endpoint returns error when create_preprod_artifact fails."""
        content = b"test preprod artifact content"
        total_checksum = sha1(content).hexdigest()

        mock_create_preprod_artifact.return_value = None

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
        assert response.status_code == 500, response.content
        assert response.data["state"] == ChunkFileState.ERROR
        assert response.data["detail"] == "Failed to create preprod artifact row."

        mock_create_preprod_artifact.assert_called_once_with(
            org_id=self.organization.id,
            project_id=self.project.id,
            checksum=total_checksum,
            build_configuration_name=None,
            release_notes=None,
            head_sha=None,
            base_sha=None,
            provider=None,
            head_repo_name=None,
            base_repo_name=None,
            head_ref=None,
            base_ref=None,
            pr_number=None,
        )

    def test_assemble_missing_vcs_parameters(self) -> None:
        """Test that providing partial VCS parameters returns a 400 error with specific missing params."""
        content = b"test missing vcs params"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        # Test missing head_ref
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "head_sha": "e" * 40,
                "provider": "github",
                "head_repo_name": "owner/repo",
                # Missing head_ref
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content
        assert "error" in response.data
        assert "Missing parameters: head_ref" in response.data["error"]

        # Test missing multiple parameters
        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "head_sha": "e" * 40,
                # Missing provider, head_repo_name, head_ref
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content
        assert "error" in response.data
        assert "Missing parameters:" in response.data["error"]
        assert "head_repo_name" in response.data["error"]
        assert "provider" in response.data["error"]
        assert "head_ref" in response.data["error"]

    def test_assemble_same_head_and_base_sha(self) -> None:
        """Test that providing the same value for head_sha and base_sha returns a 400 error."""
        content = b"test same sha"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        same_sha = "e" * 40

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "head_sha": same_sha,
                "base_sha": same_sha,
                "provider": "github",
                "head_repo_name": "owner/repo",
                "head_ref": "feature/xyz",
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content
        assert "error" in response.data
        assert "Head SHA and base SHA cannot be the same" in response.data["error"]
        assert same_sha in response.data["error"]

    def test_assemble_base_sha_without_head_sha(self) -> None:
        """Test that providing base_sha without head_sha returns a 400 error."""
        content = b"test base sha without head sha"
        total_checksum = sha1(content).hexdigest()

        blob = FileBlob.from_file(ContentFile(content))
        FileBlobOwner.objects.get_or_create(organization_id=self.organization.id, blob=blob)

        response = self.client.post(
            self.url,
            data={
                "checksum": total_checksum,
                "chunks": [blob.checksum],
                "base_sha": "f" * 40,
                # Missing head_sha
            },
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
        )
        assert response.status_code == 400, response.content
        assert "error" in response.data
        assert "Head SHA is required when base SHA is provided" in response.data["error"]
