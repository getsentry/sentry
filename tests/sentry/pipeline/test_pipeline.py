from unittest.mock import MagicMock, patch

from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest

from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline import Pipeline, PipelineProvider, PipelineView
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class PipelineStep(PipelineView):
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state("some_state", "value")


class DummyProvider(PipelineProvider):
    key = "dummy"
    name = "dummy"
    pipeline_views: list[PipelineView] = [PipelineStep(), PipelineStep()]

    def get_pipeline_views(self) -> list[PipelineView]:
        return self.pipeline_views


class DummyPipeline(Pipeline):
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
