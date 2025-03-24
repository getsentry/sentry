from __future__ import annotations

import abc
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.utils import json
from sentry.web.helpers import render_to_response

if TYPE_CHECKING:
    from sentry.pipeline.base import Pipeline


class PipelineView(abc.ABC):
    """
    A class implementing the PipelineView may be used in a PipelineProviders
    get_pipeline_views list.
    """

    @abc.abstractmethod
    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
        """
        Called on request, the active pipeline is passed in which can and
        should be used to bind data and traverse the pipeline.
        """

    @staticmethod
    def render_react_view(
        request: HttpRequest,
        pipeline_name: str,
        props: Mapping[str, Any],
    ) -> HttpResponseBase:
        return render_to_response(
            template="sentry/bases/react_pipeline.html",
            request=request,
            context={"pipelineName": pipeline_name, "props": json.dumps(props)},
        )
