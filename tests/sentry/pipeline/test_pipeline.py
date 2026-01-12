from collections.abc import Sequence
from functools import cached_property
from typing import Never
from unittest.mock import MagicMock, patch

from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest, HttpResponse

from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import ERR_MISMATCHED_USER, Pipeline, sanitize_log_message
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class PipelineStep:
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state("some_state", "value")


class DummyProvider(PipelineProvider["DummyPipeline"]):
    key = "dummy"
    name = "dummy"
    pipeline_views: list[PipelineStep] = [PipelineStep(), PipelineStep()]

    def get_pipeline_views(self) -> Sequence[PipelineStep]:
        return self.pipeline_views


class DummyPipeline(Pipeline[Never, PipelineSessionStore]):
    pipeline_name = "test_pipeline"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.finished = False
        self.dispatch_count = 0

    @cached_property
    def provider(self) -> DummyProvider:
        ret = {"dummy": DummyProvider()}[self._provider_key]
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[PipelineStep]:
        return self.provider.get_pipeline_views()

    def finish_pipeline(self):
        self.finished = True


class SanitizeLogMessageTest(TestCase):
    def test_sanitize_normal_message(self) -> None:
        """Test that normal messages pass through unchanged."""
        message = "An error occurred during authentication"
        assert sanitize_log_message(message) == message

    def test_sanitize_empty_message(self) -> None:
        """Test that empty messages are handled gracefully."""
        assert sanitize_log_message("") == ""

    def test_sanitize_removes_control_characters(self) -> None:
        """Test that control characters are removed except tabs and newlines."""
        message = "error\x00with\x01control\x1fchars"
        sanitized = sanitize_log_message(message)
        assert "\x00" not in sanitized
        assert "\x01" not in sanitized
        assert "\x1f" not in sanitized
        assert "errorwithcontrolchars" == sanitized

    def test_sanitize_preserves_newlines(self) -> None:
        """Test that newlines are preserved in log messages (safe in logs)."""
        message = "error\nwith\nnewlines"
        sanitized = sanitize_log_message(message)
        assert "\n" in sanitized
        assert "error\nwith\nnewlines" == sanitized

    def test_sanitize_removes_ansi_escapes(self) -> None:
        """Test that ANSI escape sequences are removed."""
        message = "\x1b[31mRed Error\x1b[0m"
        sanitized = sanitize_log_message(message)
        assert "\x1b" not in sanitized
        assert "Red Error" in sanitized

    def test_sanitize_truncates_long_messages(self) -> None:
        """Test that overly long messages are truncated."""
        message = "a" * 600
        sanitized = sanitize_log_message(message)
        assert len(sanitized) <= 503  # 500 + "..."
        assert sanitized.endswith("...")

    def test_sanitize_preserves_unicode(self) -> None:
        """Test that unicode characters are preserved."""
        message = "Error: 用户被拒绝访问"
        sanitized = sanitize_log_message(message)
        assert "用户被拒绝访问" in sanitized

    def test_sanitize_command_injection(self) -> None:
        """Test that command injection attempts are sanitized."""
        message = "Error: &nslookup\x00 -q=cname test.bxss.me&"
        sanitized = sanitize_log_message(message)
        # Null bytes should be removed
        assert "\x00" not in sanitized
        # But the rest should be preserved (just cleaned)
        assert "nslookup" in sanitized


@control_silo_test
class PipelineTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org = serialize_rpc_organization(self.create_organization())
        self.request = HttpRequest()
        self.request.session = SessionBase()
        self.request.user = self.user

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_simple_pipeline(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org, config={"some_config": True})
        pipeline.initialize()

        assert pipeline.is_valid()
        assert "some_config" in pipeline.provider.config
        mock_bind_org_context.assert_called_with(self.org)

        # Pipeline has two steps, ensure both steps compete. Usually the
        # dispatch itself would be the one calling the current_step and
        # next_step methods after it determines if it can move forward a step.
        pipeline.current_step()
        assert pipeline.dispatch_count == 1
        assert pipeline.fetch_state("some_state") == "value"

        pipeline.next_step()
        assert pipeline.dispatch_count == 2

        pipeline.next_step()
        assert pipeline.dispatch_count == 2
        assert pipeline.finished

        pipeline.clear_session()
        assert not pipeline.state.is_valid()

    def test_invalidated_pipeline(self) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        assert pipeline.is_valid()

        # Mutate the provider, Remove an item from the pipeline, thus
        # invalidating the pipeline.
        with patch.object(DummyProvider, "pipeline_views", [PipelineStep()]):
            new_pipeline = DummyPipeline.get_for_request(self.request)
            assert new_pipeline is not None

            assert not new_pipeline.is_valid()

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_pipeline_intercept_fails(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org, config={"some_config": True})
        pipeline.initialize()

        assert pipeline.is_valid()
        assert "some_config" in pipeline.provider.config
        mock_bind_org_context.assert_called_with(self.org)

        pipeline.current_step()
        assert pipeline.dispatch_count == 1

        # Pipeline advancer uses pipeline_cls.get_for_request() to fetch pipeline from new incoming request
        request = HttpRequest()
        request.session = self.request.session  # duplicate session
        request.user = self.create_user()

        intercepted_pipeline = DummyPipeline.get_for_request(request)
        assert intercepted_pipeline is not None

        # The pipeline errors because the user is different from the one that initialized it
        resp = intercepted_pipeline.next_step()
        assert isinstance(resp, HttpResponse)  # TODO(cathy): fix typing on
        assert ERR_MISMATCHED_USER.encode() in resp.content

    @patch("sentry.pipeline.base.sanitize_log_message")
    def test_error_sanitizes_message(self, mock_sanitize: MagicMock) -> None:
        """Test that Pipeline.error() sanitizes error messages before logging."""
        mock_sanitize.return_value = "sanitized_error"
        
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()
        
        malicious_error = "Error with\x00control\nchars"
        response = pipeline.error(malicious_error)
        
        # Verify sanitize was called
        mock_sanitize.assert_called_once_with(malicious_error)
        
        # Verify the response uses the sanitized error
        assert b"sanitized_error" in response.content

    def test_error_integration(self) -> None:
        """Integration test that error messages are properly sanitized."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()
        
        malicious_error = "Error with\x00null\x1fbytes"
        response = pipeline.error(malicious_error)
        
        # Verify control characters are removed
        assert b"\x00" not in response.content
        assert b"\x1f" not in response.content
        assert b"Error with" in response.content

