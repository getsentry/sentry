import abc
from typing import TYPE_CHECKING, Any, Mapping

from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.utils import json
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response

if TYPE_CHECKING:
    from sentry.pipeline.base import Pipeline


class PipelineView(BaseView, abc.ABC):
    """
    A class implementing the PipelineView may be used in a PipelineProviders
    get_pipeline_views list.
    """

    @abc.abstractmethod
    def dispatch(self, request: Request, pipeline: "Pipeline") -> HttpResponseBase:
        """
        Called on request, the active pipeline is passed in which can and
        should be used to bind data and traverse the pipeline.
        """
        pass

    @staticmethod
    def render_react_view(
        request: Request,
        pipeline_name: str,
        props: Mapping[str, Any],
    ) -> HttpResponseBase:
        return render_to_response(
            template="sentry/bases/react_pipeline.html",
            request=request,
            context={"pipelineName": pipeline_name, "props": json.dumps(props)},
        )
