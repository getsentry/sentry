import logging
from datetime import timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.models.organization import Organization
from sentry.seer.models import SummarizePageWebVitalsResponse
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


def get_page_web_vitals_summary(
    traceSlugs: list[str],
    traceTrees: list[list[Any]],
    organization: Organization,
    user: User | RpcUser | AnonymousUser | None = None,
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary on web vitals for a single page given a list of traces.

    Args:
        traceSlugs: The slugs of the traces to summarize web vitals for. Equivalent to the trace IDs.
        traceTrees: The trace trees for the traces to summarize. List of spans in the EAP format.
        organization: The organization the trace belongs to.
        user: The user requesting the summary
        onlyTransaction: Whether to only summarize the entire trace or just the transaction spans.

    Returns:
        A tuple containing (summary_data, status_code)
    """
    if user is None:
        user = AnonymousUser()

    cache_key = "ai-page-web-vitals-summary:" + str(traceSlugs)
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    print("--------------------------------")
    print("calling seer")
    print("--------------------------------")
    trace_summary = _call_seer(
        traceSlugs,
        traceTrees,
    )

    trace_summary_dict = trace_summary.dict()

    cache.set(cache_key, trace_summary_dict, timeout=int(timedelta(days=7).total_seconds()))

    return convert_dict_key_case(trace_summary_dict, snake_to_camel_case), 200


def _call_seer(
    trace_ids: list[str],
    trace_contents: list[list[Any]],
) -> SummarizePageWebVitalsResponse:

    path = "/v1/automation/summarize/page-web-vitals"
    body = orjson.dumps(
        {
            "trace_ids": trace_ids,
            "traces": [
                {
                    "trace_id": trace_id,
                    "trace": trace_content,
                }
                for trace_id, trace_content in zip(trace_ids, trace_contents)
            ],
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
    print("--------------------------------")
    print("seer response")
    print("--------------------------------")
    print(response.json())

    return SummarizePageWebVitalsResponse.validate(response.json())
