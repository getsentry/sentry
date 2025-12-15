from typing import Any

import orjson
from django.test import override_settings

from sentry.preprod.api.endpoints.project_preprod_artifact_update import find_or_create_release
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase


class ProjectPreprodArtifactUpdateEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")
        self.preprod_artifact = self.create_preprod_artifact(
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )

    def _get_url(self, artifact_id=None):
        artifact_id = artifact_id or self.preprod_artifact.id
        return f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{artifact_id}/update/"

    def _make_request(self, data, artifact_id=None, authenticated=True):
        url = self._get_url(artifact_id)
        json_data = orjson.dumps(data) if isinstance(data, dict) else data

        kwargs: dict[str, Any] = {"data": json_data, "content_type": "application/json"}
        if authenticated:
            signature = generate_service_request_signature(
                url, json_data, ["test-secret-key"], "Launchpad"
            )
            kwargs["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        return self.client.put(url, **kwargs)

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_success(self) -> None:
        data = {
            "date_built": "2024-01-01T00:00:00Z",
            "artifact_type": 1,
            "build_version": "1.2.3",
            "build_number": 123,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert resp_data["artifactId"] == str(self.preprod_artifact.id)
        assert set(resp_data["updatedFields"]) == {
            "date_built",
            "artifact_type",
            "build_version",
            "build_number",
            "state",
        }

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.date_built is not None
        assert self.preprod_artifact.date_built.isoformat() == "2024-01-01T00:00:00+00:00"
        assert self.preprod_artifact.artifact_type == 1
        assert self.preprod_artifact.build_version == "1.2.3"
        assert self.preprod_artifact.build_number == 123

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_partial_update(self) -> None:
        data = {"artifact_type": 2, "error_message": "Build failed"}
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updatedFields"]) == {"artifact_type", "error_message", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.artifact_type == 2
        assert self.preprod_artifact.error_message == "Build failed"
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_sets_failed_state_on_error(self) -> None:
        # Test that setting error_code sets state to FAILED
        data = {"error_code": 1}
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updatedFields"]) == {"error_code", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.error_code == 1
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

        # Reset for next test
        self.preprod_artifact.state = PreprodArtifact.ArtifactState.UPLOADING
        self.preprod_artifact.error_code = None
        self.preprod_artifact.save()

        # Test that setting error_message sets state to FAILED
        data_two = {"error_message": "Processing failed"}
        response = self._make_request(data_two)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updatedFields"]) == {"error_message", "state"}

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.error_message == "Processing failed"
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_not_found(self) -> None:
        response = self._make_request({"artifact_type": 1}, artifact_id=999999)
        assert response.status_code == 404
        assert "The requested head preprod artifact does not exist" in response.json()["detail"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_invalid_json(self) -> None:
        response = self._make_request(b"invalid json")
        assert response.status_code == 400
        assert "Invalid json body" in response.json()["error"]

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_invalid_schema(self) -> None:
        response = self._make_request({"artifact_type": 99})  # Invalid value
        assert response.status_code == 400
        assert (
            "The artifact_type field must be an integer between 0 and 2."
            in response.json()["error"]
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_extra_properties(self) -> None:
        response = self._make_request({"artifact_type": 1, "extra_field": "not allowed"})
        assert response.status_code == 200

    def test_update_preprod_artifact_unauthorized(self) -> None:
        response = self._make_request({"artifact_type": 1}, authenticated=False)
        assert response.status_code == 401

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_empty_update(self) -> None:
        response = self._make_request({})
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert resp_data["updatedFields"] == []

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_apple_app_info(self) -> None:
        apple_info = {
            "is_simulator": True,
            "codesigning_type": "development",
            "profile_name": "Test Profile",
            "is_code_signature_valid": False,
            "code_signature_errors": ["Certificate expired", "Missing entitlements"],
            "missing_dsym_binaries": ["TestLib.dylib", "TestFramework.framework"],
        }
        data = {
            "date_built": "2024-01-01T00:00:00Z",
            "artifact_type": 1,
            "build_version": "1.2.3",
            "build_number": 123,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updatedFields"]

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = self.preprod_artifact.extras or {}
        # Verify that missing_dsym_binaries array is converted to has_missing_dsym_binaries boolean
        expected_extras = {
            "is_simulator": True,
            "codesigning_type": "development",
            "profile_name": "Test Profile",
            "is_code_signature_valid": False,
            "code_signature_errors": ["Certificate expired", "Missing entitlements"],
            "has_missing_dsym_binaries": True,  # Converted from non-empty array
        }
        assert stored_apple_info == expected_extras

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_android_app_info(self) -> None:
        android_info = {
            "has_proguard_mapping": True,
        }
        data = {
            "date_built": "2024-01-01T00:00:00Z",
            "artifact_type": 2,
            "build_version": "1.2.3",
            "build_number": 123,
            "android_app_info": android_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updatedFields"]

        self.preprod_artifact.refresh_from_db()
        stored_android_info = self.preprod_artifact.extras or {}
        assert stored_android_info == android_info
        assert stored_android_info["has_proguard_mapping"] is True

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_missing_dsym_binaries_empty_array(self) -> None:
        """Test that empty missing_dsym_binaries array converts to has_missing_dsym_binaries=False."""
        apple_info: dict[str, Any] = {"missing_dsym_binaries": []}
        data = {
            "artifact_type": 1,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = self.preprod_artifact.extras or {}
        assert stored_apple_info.get("has_missing_dsym_binaries") is False

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_missing_dsym_binaries_non_empty_array(self) -> None:
        """Test that non-empty missing_dsym_binaries array converts to has_missing_dsym_binaries=True."""
        # Even a large list should just convert to True
        large_list = [f"VeryLongLibraryName{i:04d}.dylib" for i in range(40)]
        apple_info: dict[str, Any] = {"missing_dsym_binaries": large_list}
        data = {
            "artifact_type": 1,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = self.preprod_artifact.extras or {}
        assert stored_apple_info.get("has_missing_dsym_binaries") is True

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_partial_apple_app_info(self) -> None:
        apple_info = {
            "is_simulator": False,
            "codesigning_type": "distribution",
        }
        data = {
            "artifact_type": 2,
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updatedFields"]

        self.preprod_artifact.refresh_from_db()
        stored_apple_info = self.preprod_artifact.extras or {}
        # Should only contain the fields that were provided
        assert stored_apple_info == apple_info
        assert "profile_name" not in stored_apple_info
        assert "is_code_signature_valid" not in stored_apple_info

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_preserves_existing_extras(self) -> None:
        """Test that updating with apple_app_info preserves existing extras data like release_notes"""
        # First, create an artifact with existing extras (release notes)
        self.preprod_artifact.extras = {"release_notes": "Important bug fixes in this release"}
        self.preprod_artifact.save()

        # Update with apple app info
        apple_info = {
            "is_simulator": False,
            "codesigning_type": "distribution",
            "profile_name": "Production Profile",
        }
        data = {
            "apple_app_info": apple_info,
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updatedFields"]

        self.preprod_artifact.refresh_from_db()
        stored_extras = self.preprod_artifact.extras or {}

        # Should contain both the original release notes and the new apple app info
        assert stored_extras["release_notes"] == "Important bug fixes in this release"
        assert stored_extras["is_simulator"] is False
        assert stored_extras["codesigning_type"] == "distribution"
        assert stored_extras["profile_name"] == "Production Profile"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_release_only_created_on_first_transition_to_processed(self) -> None:
        from sentry.models.release import Release

        data = {
            "app_id": "com.example.app",
            "build_version": "1.0.0",
            "build_number": 123,
        }
        response = self._make_request(data)
        assert response.status_code == 200

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.PROCESSED

        releases = Release.objects.filter(
            organization_id=self.project.organization_id,
            projects=self.project,
            version="com.example.app@1.0.0+123",
        )
        assert releases.count() == 1
        created_release = releases.first()
        assert created_release is not None

        data2 = {
            "date_built": "2024-01-01T00:00:00Z",
        }
        response2 = self._make_request(data2)
        assert response2.status_code == 200

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.PROCESSED

        releases_after = Release.objects.filter(
            organization_id=self.project.organization_id,
            projects=self.project,
            version="com.example.app@1.0.0+123",
        )
        assert releases_after.count() == 1
        first_release = releases_after.first()
        assert first_release is not None
        assert first_release.id == created_release.id

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_release_created_when_conditions_met_even_no_fields_updated(self) -> None:
        from sentry.models.release import Release

        self.preprod_artifact.state = PreprodArtifact.ArtifactState.PROCESSED
        self.preprod_artifact.app_id = "com.example.app"
        self.preprod_artifact.build_version = "1.0.0"
        self.preprod_artifact.build_number = 123
        self.preprod_artifact.save()

        response = self._make_request({})
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["updatedFields"] == []

        releases = Release.objects.filter(
            organization_id=self.project.organization_id,
            projects=self.project,
            version="com.example.app@1.0.0+123",
        )
        assert releases.count() == 1

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_dequeued_at(self) -> None:
        data = {
            "dequeued_at": "2024-04-07T14:03:18+00:00",
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert "extras" in resp_data["updatedFields"]

        self.preprod_artifact.refresh_from_db()
        stored_extras = self.preprod_artifact.extras or {}
        assert stored_extras["dequeued_at"] == "2024-04-07T14:03:18+00:00"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_preserves_existing_data(self) -> None:
        self.preprod_artifact.extras = {"is_simulator": False, "existing_field": "value"}
        self.preprod_artifact.save()

        data = {
            "dequeued_at": "2024-04-07T14:03:18+00:00",
        }
        response = self._make_request(data)

        assert response.status_code == 200
        self.preprod_artifact.refresh_from_db()
        stored_extras = self.preprod_artifact.extras or {}

        assert stored_extras["dequeued_at"] == "2024-04-07T14:03:18+00:00"
        assert stored_extras["is_simulator"] is False
        assert stored_extras["existing_field"] == "value"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_tooling_versions_apple(self) -> None:
        data = {
            "apple_app_info": {
                "cli_version": "2.39.1",
                "fastlane_plugin_version": "2.220.0",
            }
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updatedFields"]) == {
            "cli_version",
            "fastlane_plugin_version",
            "state",
        }

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.cli_version == "2.39.1"
        assert self.preprod_artifact.fastlane_plugin_version == "2.220.0"
        assert self.preprod_artifact.gradle_plugin_version is None
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.PROCESSED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=["test-secret-key"])
    def test_update_preprod_artifact_with_tooling_versions_android(self) -> None:
        data = {
            "android_app_info": {
                "cli_version": "2.39.1",
                "gradle_plugin_version": "8.5.2",
            }
        }
        response = self._make_request(data)

        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["success"] is True
        assert set(resp_data["updatedFields"]) == {
            "cli_version",
            "gradle_plugin_version",
            "state",
        }

        self.preprod_artifact.refresh_from_db()
        assert self.preprod_artifact.cli_version == "2.39.1"
        assert self.preprod_artifact.fastlane_plugin_version is None
        assert self.preprod_artifact.gradle_plugin_version == "8.5.2"
        assert self.preprod_artifact.state == PreprodArtifact.ArtifactState.PROCESSED


class FindOrCreateReleaseTest(TestCase):
    def test_exact_version_matching_prevents_incorrect_matches(self):
        package = "com.hackernews"
        version = "1.2.3"

        self.create_release(project=self.project, version=f"{package}@{version}333333")
        self.create_release(project=self.project, version=f"{package}@{version}.0")
        self.create_release(project=self.project, version=f"{package}@{version}-beta")

        result = find_or_create_release(self.project, package, version)

        assert result is not None
        assert result.version == f"{package}@{version}"

    def test_finds_existing_release_regardless_of_build_number(self):
        package = "com.example.app"
        version = "2.1.0"

        existing_release = self.create_release(
            project=self.project, version=f"{package}@{version}+456"
        )

        result = find_or_create_release(self.project, package, version)
        assert result is not None
        assert result.id == existing_release.id

        result_with_build = find_or_create_release(self.project, package, version, 789)
        assert result_with_build is not None
        assert result_with_build.id == existing_release.id
        assert result_with_build.version == f"{package}@{version}+456"
