from unittest import mock

import pytest

from sentry.autopilot.tasks.common import AutopilotDetectorName
from sentry.autopilot.tasks.sdk_update import run_sdk_update_detector_for_organization
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class TestRunSdkUpdateDetector(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project2 = self.create_project(organization=self.organization)

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_simple(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 1
        assert updates[0] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created
        assert mock_create_issue.call_count == 1
        call_kwargs = mock_create_issue.call_args[1]
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["detector_name"] == AutopilotDetectorName.SDK_UPDATE
        assert "example.sdk" in call_kwargs["title"]
        assert "1.0.0" in call_kwargs["subtitle"]
        assert "1.4.0" in call_kwargs["subtitle"]

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.4.0"},
    )
    def test_it_handles_multiple_projects(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk", "version": "0.9.0"},
            },
            project_id=self.project2.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 2
        assert updates[0] == {
            "projectId": str(self.project2.id),
            "sdkName": "example.sdk",
            "sdkVersion": "0.9.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }
        assert updates[1] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created for each update
        assert mock_create_issue.call_count == 2

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.4.0", "example.sdk2": "1.2.0"},
    )
    def test_it_handles_multiple_sdks(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-2"],
                "sdk": {"name": "example.sdk2", "version": "0.9.0"},
            },
            project_id=self.project2.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 2
        assert updates[0] == {
            "projectId": str(self.project2.id),
            "sdkName": "example.sdk2",
            "sdkVersion": "0.9.0",
            "newestSdkVersion": "1.2.0",
            "needsUpdate": True,
        }
        assert updates[1] == {
            "projectId": str(self.project.id),
            "sdkName": "example.sdk",
            "sdkVersion": "1.0.0",
            "newestSdkVersion": "1.4.0",
            "needsUpdate": True,
        }

        # Verify that an instrumentation issue was created for each SDK
        assert mock_create_issue.call_count == 2

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_patch_versions(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "1.0.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_unknown_sdks(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk.unknown", "version": "0.9.0"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0

    @pytest.mark.django_db
    @mock.patch("sentry.autopilot.tasks.sdk_update.create_instrumentation_issue")
    @mock.patch(
        "sentry.autopilot.tasks.sdk_update.get_sdk_versions",
        return_value={"example.sdk": "1.0.5"},
    )
    def test_it_ignores_invalid_sdk_versions(
        self, mock_get_sdk_versions: mock.MagicMock, mock_create_issue: mock.MagicMock
    ) -> None:
        min_ago = before_now(minutes=1).isoformat()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "sdk": {"name": "example.sdk", "version": "abcdefg"},
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        with override_options({"autopilot.organization-allowlist": [self.organization.slug]}):
            updates = run_sdk_update_detector_for_organization(self.organization)

        assert len(updates) == 0
        # No instrumentation issue should be created
        assert mock_create_issue.call_count == 0
