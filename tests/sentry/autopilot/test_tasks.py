from unittest import mock

from sentry.autopilot.tasks import run_sdk_update_detector_for_organization
from sentry.sdk_updates import SdkIndexState
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class TestRunSdkUpdateDetector(SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project2 = self.create_project(organization=self.organization)

    @mock.patch(
        "sentry.api.endpoints.organization_sdk_updates.SdkIndexState",
        return_value=SdkIndexState(sdk_versions={"example.sdk": "2.0.0"}),
    )
    def test_simple(self, mock_index_state: mock.MagicMock) -> None:
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

        updates = run_sdk_update_detector_for_organization(self.organization)
        assert len(updates) == 1
        assert updates[0]["suggestions"][0] == {
            "type": "updateSdk",
            "sdkName": "example.sdk",
            "newSdkVersion": "2.0.0",
            "sdkUrl": None,
            "enables": [],
        }
