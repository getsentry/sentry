import logging
import re
from datetime import timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features
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
    user: User | RpcUser | AnonymousUser,
) -> tuple[dict[str, Any], int]:
    """
    Generate an AI summary on web vitals for a single page given a list of traces.

    Args:
        traceSlugs: The slugs of the traces to summarize web vitals for. Equivalent to the trace IDs.
        traceTrees: The trace trees for the traces to summarize. List of spans in the EAP format.
        organization: The organization the trace belongs to.
        user: The user requesting the summary

    Returns:
        A tuple containing (summary_data, status_code)
    """
    if not features.has(
        "organizations:performance-web-vitals-seer-suggestions", organization, actor=user
    ):
        return {"detail": "Feature flag not enabled"}, 400

    cache_key = "ai-page-web-vitals-summary:" + "-".join(sorted(traceSlugs))
    if cached_summary := cache.get(cache_key):
        return convert_dict_key_case(cached_summary, snake_to_camel_case), 200

    page_web_vitals_summary = _call_seer(
        traceSlugs,
        traceTrees,
    )

    page_web_vitals_summary_dict = page_web_vitals_summary.dict()

    cache.set(
        cache_key, page_web_vitals_summary_dict, timeout=int(timedelta(days=7).total_seconds())
    )

    return convert_dict_key_case(page_web_vitals_summary_dict, snake_to_camel_case), 200


def _get_frontend_spans(trace: list[dict] | dict, depth: int = 0) -> list[dict]:
    """
    Filters the trace to only include frontend spans.
    Frontend spans ops include:
    - ui.*
    - resource.*
    - browser.*
    - navigation
    - pageload
    - mark
    - measure
    - paint
    """
    if not trace or depth > 50:
        return []

    if isinstance(trace, list):
        frontend_spans = []
        for span in trace:
            frontend_spans.extend(_get_frontend_spans(span, depth))
        return frontend_spans

    frontend_spans = []

    if len(trace.get("children", [])) > 0:
        parent_span = trace.copy()
        descendant_frontend_spans = _get_frontend_spans(parent_span.get("children", []), depth + 1)
        if _is_frontend_span(parent_span):
            parent_span["children"] = descendant_frontend_spans
            frontend_spans.append(parent_span)
        else:
            frontend_spans.extend(descendant_frontend_spans)
    else:
        if _is_frontend_span(trace):
            frontend_spans.append(trace)

    return frontend_spans


def _is_frontend_span(span: dict) -> bool:
    span_op = span.get("op")
    if span_op and (
        re.match(r"^(ui\.|resource\.|browser\.)", span_op)
        or span_op in ["mark", "measure", "paint", "navigation", "pageload"]
    ):
        return True
    return False


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
                    "trace": _get_frontend_spans(trace_content),
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

    return SummarizePageWebVitalsResponse.validate(response.json())
