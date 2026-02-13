from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.utils import json
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import determine_active_organization
from sentry.web.helpers import render_to_response


class PipelineView[P](Protocol):
    def dispatch(self, request: HttpRequest, pipeline: P) -> HttpResponseBase: ...


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
