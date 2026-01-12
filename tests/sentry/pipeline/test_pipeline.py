from collections.abc import Sequence
from functools import cached_property
from typing import Never
from unittest.mock import MagicMock, patch

from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest, HttpResponse

from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import ERR_MISMATCHED_USER, Pipeline
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

    def test_error_message_xss_esi_include(self) -> None:
        """Test that ESI include tags in error messages are properly escaped."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        xss_payload = '1<esi:include src="http://bxss.me/rpb.png"/>'
        resp = pipeline.error(xss_payload)

        assert isinstance(resp, HttpResponse)
        content = resp.content.decode("utf-8")
        # Verify the response contains escaped HTML
        assert "&lt;esi:include" in content
        # Ensure the raw XSS payload is NOT present
        assert '<esi:include src="http://bxss.me/rpb.png"/>' not in content

    def test_error_message_xss_script_tag(self) -> None:
        """Test that script tags in error messages are properly escaped."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        xss_payload = '<script>alert("XSS")</script>'
        resp = pipeline.error(xss_payload)

        assert isinstance(resp, HttpResponse)
        content = resp.content.decode("utf-8")
        # Verify the response contains escaped HTML
        assert "&lt;script&gt;" in content
        assert "&lt;/script&gt;" in content
        # Ensure the raw script tag is NOT present
        assert '<script>alert("XSS")</script>' not in content

    def test_error_message_xss_img_tag(self) -> None:
        """Test that img tags with onerror in error messages are properly escaped."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        xss_payload = '<img src=x onerror=alert("XSS")>'
        resp = pipeline.error(xss_payload)

        assert isinstance(resp, HttpResponse)
        content = resp.content.decode("utf-8")
        # Verify the response contains escaped HTML
        assert "&lt;img" in content
        # Ensure the raw img tag is NOT present
        assert '<img src=x onerror=alert("XSS")>' not in content

    def test_render_warning_xss_protection(self) -> None:
        """Test that warning messages are also protected against XSS."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        xss_payload = '"><svg/onload=alert(1)>'
        resp = pipeline.render_warning(xss_payload)

        assert isinstance(resp, HttpResponse)
        content = resp.content.decode("utf-8")
        # Verify the response contains escaped HTML
        assert "&lt;svg" in content or '"&gt;&lt;svg' in content
        # Ensure the raw payload is NOT present
        assert '"><svg/onload=alert(1)>' not in content

    def test_normal_error_still_displayed(self) -> None:
        """Test that normal error messages are still displayed correctly."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        normal_error = "An error occurred while validating your request."
        resp = pipeline.error(normal_error)

        assert isinstance(resp, HttpResponse)
        content = resp.content.decode("utf-8")
        # Verify the normal error message is displayed
        assert "An error occurred while validating your request." in content
