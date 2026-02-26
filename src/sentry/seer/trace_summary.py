import logging
from datetime import timedelta
from typing import Any

import orjson
from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.organization import Organization
from sentry.seer.models import SeerApiError, SummarizeTraceResponse
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_summarization_default_connection_pool,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


def get_trace_summary(
    traceSlug: str,
    traceTree: list[Any],
    organization: Organization,
    user: User | RpcUser | AnonymousUser | None = None,
    onlyTransaction: bool = False,
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary for a single trace. Trace must be in the EAP format.

    Args:
        traceSlug: The slug of the trace to summarize. Equivalent to the trace ID.
        traceTree: The trace tree for the trace to summarize. List of spans in the EAP format.
        organization: The organization the trace belongs to.
        user: The user requesting the summary
        onlyTransaction: Whether to only summarize the entire trace or just the transaction spans.

    Returns:
        A tuple containing (summary_data, status_code)
    """
    if user is None:
        user = AnonymousUser()
    if not features.has("organizations:single-trace-summary", organization, actor=user):
        return {"detail": "Feature flag not enabled"}, 400

    cache_key = "ai-trace-summary:" + str(traceSlug)
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    trace_summary = _call_seer(
        traceSlug,
        traceTree,
        onlyTransaction,
    )

    trace_summary_dict = trace_summary.dict()

    cache.set(cache_key, trace_summary_dict, timeout=int(timedelta(days=7).total_seconds()))

    return convert_dict_key_case(trace_summary_dict, snake_to_camel_case), 200


def _call_seer(
    trace_id: str,
    trace_content: list[Any],
    only_transaction: bool = False,
) -> SummarizeTraceResponse:
    path = "/v1/automation/summarize/trace"
    body = orjson.dumps(
        {
            "trace_id": trace_id,
            "only_transaction": only_transaction,
            "trace": {
                "trace_id": trace_id,
                "trace": trace_content,
            },
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = make_signed_seer_api_request(
        seer_summarization_default_connection_pool,
        path,
        body,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)

    return SummarizeTraceResponse.validate(response.json())
