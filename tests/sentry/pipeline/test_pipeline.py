from __future__ import absolute_import

from django.http import HttpRequest

from sentry.testutils import TestCase
from sentry.pipeline import PipelineProvider, PipelineView, Pipeline


class PipelineStep(PipelineView):
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state("some_state", "value")


class DummyProvider(PipelineProvider):
    key = "dummy"
    pipeline_views = [PipelineStep(), PipelineStep()]

    def get_pipeline_views(self):
        return self.pipeline_views


class DummyPipeline(Pipeline):
    pipeline_name = "test_pipeline"

    # Simplify tests, the manager can just be a dict.
    provider_manager = {"dummy": DummyProvider()}

    def finish_pipeline(self):
        self.finished = True


class PipelineTestCase(TestCase):
    def test_simple_pipeline(self):
        org = self.create_organization()
        request = HttpRequest()
        request.session = {}
        request.user = self.user

        pipeline = DummyPipeline(request, "dummy", org, config={"some_config": True})
        pipeline.initialize()

        assert pipeline.is_valid()

        assert "some_config" in pipeline.provider.config

        # Test state
        pipeline.finished = False
        pipeline.dispatch_count = 0

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
        org = self.create_organization()
        request = HttpRequest()
        request.session = {}
        request.user = self.user

        pipeline = DummyPipeline(request, "dummy", org)
        pipeline.initialize()

        assert pipeline.is_valid()

        # Mutate the provider, Remove an item from the pipeline, thus
        # invalidating the pipeline.
        prev_pipeline_views = DummyProvider.pipeline_views
        DummyProvider.pipeline_views = [PipelineStep()]

        pipeline = DummyPipeline.get_for_request(request)

        assert not pipeline.is_valid()

        DummyProvider.pipeline_views = prev_pipeline_views
