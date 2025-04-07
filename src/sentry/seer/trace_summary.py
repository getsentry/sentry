import logging
from datetime import timedelta

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.organization import Organization
from sentry.seer.models import SummarizeTraceResponse
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


def get_trace_summary(
    traceSlug: str,
    traceTree: list[dict],
    organization: Organization,
    user: User | RpcUser | AnonymousUser | None = None,
):
    """
    Generate an AI summary for a single trace. Trace must be in the EAP format.

    Args:
        traceSlug: The slug of the trace to summarize. Equivalent to the trace ID.
        timestamp: The timestamp of the root event of the trace.
        traceTree: The trace tree for the trace to summarize. List of spans in the EAP format.
        organization: The organization the trace belongs to.
        user: The user requesting the summary

    Returns:
        A dictionary containing the trace summary.
    """
    if user is None:
        user = AnonymousUser()
    if not features.has("organizations:single-trace-summary", organization, actor=user):
        return {"detail": "Feature flag not enabled"}, 400

    cache_key = "ai-trace-summary:" + str(traceSlug)
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    trace_summary = None
    try:
        trace_summary = _call_seer(
            traceSlug,
            traceTree,
        )
    except Exception as e:
        logger.exception("Error calling Seer: %s", e)
        return {"detail": "Error calling Seer"}, 500

    trace_summary_dict = trace_summary.dict()

    cache.set(cache_key, trace_summary_dict, timeout=int(timedelta(days=7).total_seconds()))

    return trace_summary_dict


def _call_seer(
    trace_id: str,
    trace_content: list[dict],
    only_transaction: bool = False,
) -> SummarizeTraceResponse:

    path = "/v1/automation/summarize/trace"
    body = orjson.dumps(
        {
            "trace_id": trace_id,
            "only_transaction": only_transaction,
            "trace": {
                "trace_id": trace_id,
                "trace_content": trace_content,
            },
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()

    return SummarizeTraceResponse.validate(response.json())
