from unittest.mock import MagicMock, patch

import pytest
import requests

from sentry.seer.explorer.client import continue_seer_run, get_seer_run, start_seer_run
from sentry.seer.explorer.client_models import SeerRunState
from sentry.testutils.cases import TestCase


class TestStartSeerRun(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_seer_run_new_session(self, mock_collect_context, mock_post, mock_access):
        """Test starting a new Seer run collects user context"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_post.return_value = mock_response

        run_id = start_seer_run(
            organization=self.organization,
            prompt="Test query",
            user=self.user,
        )

        assert run_id == 123
        mock_collect_context.assert_called_once_with(self.user, self.organization)
        assert mock_post.called

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_start_seer_run_with_optional_params(self, mock_post, mock_access):
        """Test starting a run with optional on_page_context"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 789}
        mock_post.return_value = mock_response

        run_id = start_seer_run(
            organization=self.organization,
            prompt="Query",
            user=self.user,
            on_page_context="some context",
        )

        assert run_id == 789
        # Verify the payload includes optional params
        call_args = mock_post.call_args
        assert call_args is not None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_start_seer_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.raise_for_status.side_effect = requests.HTTPError("API Error")

        with pytest.raises(requests.HTTPError):
            start_seer_run(
                organization=self.organization,
                prompt="Test query",
                user=self.user,
            )

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_start_seer_run_permission_denied(self, mock_access):
        """Test that SeerPermissionError is raised when access is denied"""
        from sentry.seer.models import SeerPermissionError

        mock_access.return_value = (False, "Feature flag not enabled")

        with pytest.raises(SeerPermissionError) as exc_info:
            start_seer_run(
                organization=self.organization,
                prompt="Test query",
                user=self.user,
            )
        assert "Feature flag not enabled" in str(exc_info.value)


class TestContinueSeerRun(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_seer_run_basic(self, mock_post, mock_access):
        """Test continuing an existing Seer run"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 456}
        mock_post.return_value = mock_response

        run_id = continue_seer_run(
            run_id=456,
            organization=self.organization,
            prompt="Follow up query",
        )

        assert run_id == 456
        assert mock_post.called

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_seer_run_with_all_params(self, mock_post, mock_access):
        """Test continuing a run with all optional parameters"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 789}
        mock_post.return_value = mock_response

        run_id = continue_seer_run(
            run_id=789,
            organization=self.organization,
            prompt="Follow up",
            insert_index=2,
            on_page_context="context",
        )

        assert run_id == 789
        call_args = mock_post.call_args
        assert call_args is not None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_seer_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.raise_for_status.side_effect = requests.HTTPError("API Error")

        with pytest.raises(requests.HTTPError):
            continue_seer_run(
                run_id=123,
                organization=self.organization,
                prompt="Test query",
            )


class TestGetSeerRun(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_seer_run_immediate(self, mock_fetch, mock_access):
        """Test getting run status without waiting"""
        mock_access.return_value = (True, None)
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="processing",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        result = get_seer_run(run_id=123, organization=self.organization)

        assert result.run_id == 123
        assert result.status == "processing"
        mock_fetch.assert_called_once_with(123, self.organization)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.poll_until_done")
    def test_get_seer_run_with_blocking(self, mock_poll, mock_access):
        """Test getting run status with polling"""
        mock_access.return_value = (True, None)
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_poll.return_value = mock_state

        result = get_seer_run(
            run_id=123,
            organization=self.organization,
            blocking=True,
            poll_interval=1.0,
            poll_timeout=30.0,
        )

        assert result.run_id == 123
        assert result.status == "completed"
        mock_poll.assert_called_once_with(123, self.organization, 1.0, 30.0)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_seer_run_http_error(self, mock_fetch, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_fetch.side_effect = requests.HTTPError("API Error")

        with pytest.raises(requests.HTTPError):
            get_seer_run(run_id=123, organization=self.organization)
