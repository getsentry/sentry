from __future__ import annotations

from typing import Any, Mapping

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.pipeline.views.base import PipelineView


class NestedPipelineView(PipelineView):
    """
    A NestedPipelineView can be used within other pipelines to process another
    pipeline within a pipeline. Note that the nested pipelines finish_pipeline
    will NOT be called, instead it's data will be bound into the parent
    pipeline and the parents pipeline moved to the next step.

    Useful for embedding an identity authentication pipeline.
    """

    def __init__(
        self,
        bind_key: str,
        pipeline_cls,
        provider_key: str,
        config: Mapping[str, Any] | None = None,
    ) -> None:
        self.provider_key = provider_key
        self.config = config or {}

        class NestedPipeline(pipeline_cls):
            def set_parent_pipeline(self, parent_pipeline) -> None:
                self.parent_pipeline = parent_pipeline

            def finish_pipeline(self) -> Response:
                self.parent_pipeline.bind_state(bind_key, self.fetch_state())
                self.clear_session()

                return self.parent_pipeline.next_step()

        self.pipeline_cls = NestedPipeline

    def dispatch(self, request: Request, pipeline) -> Response:
        nested_pipeline = self.pipeline_cls(
            organization=pipeline.organization,
            request=request,
            provider_key=self.provider_key,
            config=self.config,
        )

        nested_pipeline.set_parent_pipeline(pipeline)

        if not nested_pipeline.is_valid():
            nested_pipeline.initialize()

        return nested_pipeline.current_step()
