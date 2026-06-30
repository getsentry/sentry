"""Client for Seer's one-shot platform.

A one-shot is a single, synchronous structured LLM call on the Seer side: the
caller posts ``{oneshot_id, payload}`` and gets back a ``{result}`` envelope
inline (no background run, no ``run_id``, no push-back). See the ``ONESHOTS``
registry in ``seer/automation/oneshots/`` for the available one-shots and the
payload/result contract each one defines.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import Any

import orjson
from django.conf import settings
from urllib3 import BaseHTTPResponse

from sentry.models.organization import Organization
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.signed_seer_api import (
    OneShotRunRequest,
    SeerViewerContext,
    make_oneshot_request,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# A request maker from ``signed_seer_api`` (e.g. ``make_oneshot_request``):
# given a typed body, a timeout and viewer context, dispatches a single signed
# Seer call and returns the raw response.
SeerRequestMaker = Callable[..., BaseHTTPResponse]


def call_seer_oneshot(
    make_request: SeerRequestMaker,
    body: Mapping[str, Any],
    organization: Organization,
    *,
    error_metric: str,
    error_metric_tags: dict[str, Any] | None = None,
    user_id: int | None = None,
    timeout: int | float | None = None,
) -> dict[str, Any]:
    """Dispatch a single synchronous Seer task and return its parsed JSON body.

    This is the shared boilerplate behind the one-shot style Seer calls: it
    builds viewer context from ``organization`` (plus an optional ``user_id``),
    invokes ``make_request`` with the default timeout, and on a non-2xx response
    increments ``error_metric`` (merging ``error_metric_tags`` with the response
    ``status``) before raising :class:`SeerApiError`. On success it returns the
    decoded JSON object; callers shape it into their own result contract.

    Seer task endpoints require viewer context with an organization, so
    ``organization`` is mandatory.
    """
    viewer_context = SeerViewerContext(organization_id=organization.id)
    if user_id is not None:
        viewer_context["user_id"] = user_id

    response = make_request(
        body,
        timeout=timeout if timeout is not None else settings.SEER_DEFAULT_TIMEOUT,
        viewer_context=viewer_context,
    )

    if response.status >= 400:
        metrics.incr(
            error_metric,
            tags={**(error_metric_tags or {}), "status": response.status},
        )
        raise SeerApiError(response.data.decode("utf-8"), response.status)

    try:
        data: dict[str, Any] = orjson.loads(response.data)
    except orjson.JSONDecodeError:
        metrics.incr(
            error_metric,
            tags={**(error_metric_tags or {}), "status": "invalid_json"},
        )
        raise SeerApiError("Seer returned a non-JSON response body", response.status)
    return data


def run_oneshot(
    oneshot_id: str,
    payload: dict[str, Any],
    organization: Organization,
    *,
    user_id: int | None = None,
    timeout: int | float | None = None,
) -> dict[str, Any]:
    """Dispatch a one-shot to Seer and return its structured ``result``.

    The one-shot endpoint requires viewer context with an organization, so
    ``organization`` is mandatory. Raises :class:`SeerApiError` on a non-2xx
    response; callers validate the returned dict against the one-shot's result
    contract.
    """
    body = OneShotRunRequest(oneshot_id=oneshot_id, payload=payload)
    data = call_seer_oneshot(
        make_oneshot_request,
        body,
        organization,
        error_metric="seer.oneshot.error",
        error_metric_tags={"oneshot_id": oneshot_id},
        user_id=user_id,
        timeout=timeout,
    )
    return data.get("result") or {}
