from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import json
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class PipelineView(BaseView):
    """
    A class implementing the PipelineView may be used in a PipelineProviders
    get_pipeline_views list.
    """

    def dispatch(self, request: Request, pipeline) -> Response:
        """
        Called on request, the active pipeline is passed in which can and
        should be used to bind data and traverse the pipeline.
        """
        raise NotImplementedError

    def render_react_view(self, request: Request, pipelineName, props):
        return render_to_response(
            template="sentry/bases/react_pipeline.html",
            request=request,
            context={"pipelineName": pipelineName, "props": json.dumps(props)},
        )
