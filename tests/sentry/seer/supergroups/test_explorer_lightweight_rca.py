from unittest.mock import MagicMock, patch

from sentry.seer.supergroups.explorer_lightweight_rca import trigger_explorer_lightweight_rca
from sentry.testutils.cases import TestCase


class TestTriggerExplorerLightweightRca(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def test_returns_none_when_feature_flag_off(self) -> None:
        run_id = trigger_explorer_lightweight_rca(self.group)

        assert run_id is None

    @patch("sentry.seer.supergroups.explorer_lightweight_rca.SeerExplorerClient")
    def test_creates_client_with_correct_params(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.start_run.return_value = 42
        mock_client_cls.return_value = mock_client

        with self.feature("projects:supergroup-lightweight-rca"):
            run_id = trigger_explorer_lightweight_rca(self.group)

        assert run_id == 42
        mock_client_cls.assert_called_once()
        kwargs = mock_client_cls.call_args[1]
        assert kwargs["organization"] == self.organization
        assert kwargs["project"] == self.project
        assert kwargs["user"] is None
        assert kwargs["intelligence_level"] == "low"
        assert kwargs["max_iterations"] == 3
        assert kwargs["is_interactive"] is False
        assert kwargs["category_key"] == "lightweight_rca"
        assert kwargs["category_value"] == str(self.group.id)

    @patch("sentry.seer.supergroups.explorer_lightweight_rca.SeerExplorerClient")
    def test_start_run_called_with_correct_params(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.start_run.return_value = 42
        mock_client_cls.return_value = mock_client

        with self.feature("projects:supergroup-lightweight-rca"):
            trigger_explorer_lightweight_rca(self.group)

        mock_client.start_run.assert_called_once()
        kwargs = mock_client.start_run.call_args[1]
        assert kwargs["artifact_key"] == "root_cause"
        assert kwargs["prompt_metadata"] == {"step": "root_cause"}
        assert kwargs["metadata"] == {"group_id": self.group.id}
        assert "root cause" in kwargs["prompt"].lower()

    @patch("sentry.seer.supergroups.explorer_lightweight_rca.SeerExplorerClient")
    def test_returns_none_on_error(self, mock_client_cls):
        mock_client_cls.side_effect = Exception("connection failed")

        with self.feature("projects:supergroup-lightweight-rca"):
            run_id = trigger_explorer_lightweight_rca(self.group)

        assert run_id is None
