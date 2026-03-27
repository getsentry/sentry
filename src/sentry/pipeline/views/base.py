from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, Protocol

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.pipeline.types import PipelineStepResult
from sentry.utils import json
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import determine_active_organization
from sentry.web.helpers import render_to_response


class PipelineView[P](Protocol):
    """Legacy protocol for template/redirect-based pipeline steps.

    Deprecated: new pipeline steps should implement ApiPipelineEndpoint instead.
    Existing PipelineView implementations will be migrated incrementally as each
    integration adopts API mode. Once all providers have been converted, this
    protocol and the dispatch-based flow in Pipeline.current_step will be removed.
    """

    def dispatch(self, request: HttpRequest, pipeline: P) -> HttpResponseBase: ...


class ApiPipelineEndpoint[P, D = Any, V = Any](Protocol):
    """Protocol for a pipeline step that supports API mode.

    This replaces the legacy PipelineView dispatch() approach. Instead of
    rendering templates and handling redirects server-side, each step exposes
    structured data via get_step_data() and accepts validated input via
    handle_post(), allowing a React frontend to drive the flow through JSON
    API calls.

    Each provider returns a list of these via get_pipeline_api_steps(), one
    per pipeline view. The pipeline is considered API-ready when
    get_pipeline_api_steps() returns any steps (see Pipeline.is_api_ready).

    P: the pipeline type (e.g. IntegrationPipeline)
    D: the TypedDict returned by get_step_data — typed step data for the frontend
    V: the type of validated_data passed to handle_post (defaults to Any)
    """

    step_name: str

    def get_step_data(self, pipeline: P, request: HttpRequest) -> D: ...

    def get_serializer_cls(self) -> type | None: ...

    def handle_post(
        self,
        validated_data: V,
        pipeline: P,
        request: HttpRequest,
    ) -> PipelineStepResult: ...


type ApiPipelineStep[P] = ApiPipelineEndpoint[P] | Callable[[], ApiPipelineEndpoint[P]]
type ApiPipelineSteps[P] = Sequence[ApiPipelineStep[P]] | None


def render_react_view(
    request: HttpRequest,
    pipeline_name: str,
    props: Mapping[str, Any],
) -> HttpResponseBase:
    return render_to_response(
        template="sentry/bases/react_pipeline.html",
        request=request,
        context={
            "pipelineName": pipeline_name,
            "props": json.dumps(props),
            "react_config": get_client_config(request, determine_active_organization(request)),
        },
    )
