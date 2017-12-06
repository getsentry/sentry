from __future__ import absolute_import

from django.http import HttpRequest

from sentry.testutils import TestCase
from sentry.utils.pipeline import PipelineProvider, PipelineView, ProviderPipeline


class PipelineStep(PipelineView):
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state('some_state', 'value')


class DummyProvider(PipelineProvider):
    key = 'dummy'
    pipeline = [PipelineStep(), PipelineStep()]

    def get_pipeline(self):
        return self.pipeline


class DummyProviderManager(object):
    def get(self, provider_key):
        return DummyProvider()


class DummpyPipeline(ProviderPipeline):
    pipeline_name = 'test_pipeline'
    provider_manager = DummyProviderManager()

    def finish_pipeline(self):
        self.finished = 1


class PipelineTestCase(TestCase):
    def test_simple_pipeline(self):
        org = self.create_organization()
        request = HttpRequest()
        request.session = {}
        request.user = self.user

        pipeline = DummpyPipeline(request, org, 'dummy', {'some_config': True})
        pipeline.initialize()

        assert pipeline.is_valid()

        assert 'some_config' in pipeline.provider.config

        pipeline.finished = 0
        pipeline.dispatch_count = 0

        # Piepline has two steps, ensure both steps compete.
        # Usually the dispatch itself would be the one calling the current_step
        # and next_step methods after it determins if it can move forward a
        # step.
        pipeline.current_step()
        assert pipeline.dispatch_count == 1
        assert pipeline.fetch_state('some_state') == 'value'

        pipeline.next_step()
        assert pipeline.dispatch_count == 2

        pipeline.next_step()
        assert pipeline.dispatch_count == 2
        assert pipeline.finished == 1

        pipeline.clear_session()
        assert not pipeline.state.is_valid()

    def test_invalidated_pipeline(self):
        org = self.create_organization()
        request = HttpRequest()
        request.session = {}
        request.user = self.user

        pipeline = DummpyPipeline(request, org, 'dummy')
        pipeline.initialize()

        assert pipeline.is_valid()

        # Mutate the provider, Remove an item from the pipeline, thus
        # invalidating the pipeline.
        prev_pipeline = DummyProvider.pipeline
        DummyProvider.pipeline = [PipelineStep()]

        pipeline = DummpyPipeline.get_for_request(request)

        assert not pipeline.is_valid()

        DummyProvider.pipeline = prev_pipeline
