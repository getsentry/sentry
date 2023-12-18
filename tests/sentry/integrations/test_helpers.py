from __future__ import annotations

from typing import Any, List, Optional

import responses

from sentry.silo.util import PROXY_PATH


def add_control_silo_proxy_response(
    method: str | responses.BaseResponse | None,
    path: Optional[str],
    additional_matchers: Optional[List[Any]] = None,
    **additional_response_kwargs: Any,
):
    if additional_matchers is None:
        additional_matchers = []

    matchers = additional_matchers.copy()

    if path:
        matchers.append(responses.matchers.header_matcher({PROXY_PATH: path.lstrip("/")}))
    return responses.add(
        method=method,
        url="http://controlserver/api/0/internal/integration-proxy/",
        match=matchers,
        **additional_response_kwargs,
    )
