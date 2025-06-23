from collections.abc import Sequence
from typing import Never
from unittest.mock import MagicMock, patch

from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest, HttpResponse

from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import ERR_MISMATCHED_USER, Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.views.base import PipelineView
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class PipelineStep(PipelineView[Never, PipelineSessionStore]):
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state("some_state", "value")


class DummyProvider(PipelineProvider[Never, PipelineSessionStore]):
    key = "dummy"
    name = "dummy"
    pipeline_views: list[PipelineStep] = [PipelineStep(), PipelineStep()]

    def get_pipeline_views(self) -> Sequence[PipelineView[Never, PipelineSessionStore]]:
        return self.pipeline_views


class DummyPipeline(Pipeline[Never, PipelineSessionStore]):
    pipeline_name = "test_pipeline"

    # Simplify tests, the manager can just be a dict.
    provider_manager = {"dummy": DummyProvider()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.finished = False
        self.dispatch_count = 0

    def finish_pipeline(self):
        self.finished = True


@control_silo_test
class PipelineTestCase(TestCase):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org = serialize_rpc_organization(self.create_organization())
        self.request = HttpRequest()
        self.request.session = SessionBase()
        self.request.user = self.user

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_simple_pipeline(self, mock_bind_org_context: MagicMock):
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

    def test_invalidated_pipeline(self):
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
    def test_pipeline_intercept_fails(self, mock_bind_org_context: MagicMock):
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
