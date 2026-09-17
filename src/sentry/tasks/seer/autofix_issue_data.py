from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from django.db.models import F, Window
from django.db.models.functions import PercentRank
from django.utils import timezone
from pydantic import BaseModel, Field
from taskbroker_client.retry import Retry

from sentry import features
from sentry.models.organization import Organization
from sentry.ratelimits import backend as ratelimiter
from sentry.seer.models import SeerApiError
from sentry.seer.models.autofix_issue_data import SeerAutofixIssueData
from sentry.seer.signed_seer_api import (
    LlmGenerateRequest,
    SeerViewerContext,
    make_llm_generate_request,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:seer-fixability-training-data"
MAX_REVIEWS_PER_ORG_PER_DAY = 20
BOTTOM_SAMPLE_SIZE = 16
MIDDLE_SAMPLE_SIZE = 2
TOP_SAMPLE_SIZE = 2
RATE_LIMIT_WINDOW = 24 * 60 * 60
PROMPT_VERSION = "1"

SYSTEM_PROMPT = """Night Shift reviews software issues and may trigger Autofix to investigate
and open a pull request. Your job is to identify issues where opening a pull request would be
wasteful because the issue cannot be fixed in the relevant codebase.

An issue is fixable when it can reasonably be resolved with one or two pull requests to the
relevant codebase. It is not_fixable when it cannot. Choose uncertain only when the supplied
evidence is insufficient to decide. Use only the supplied issue and event evidence. Do not
assume an attempted fix, pull request, or prior automated decision.

Return only a JSON object matching this shape, with a concise one-to-two-sentence reason:
{"verdict":"fixable|not_fixable|uncertain","confidence":"high|medium|low","reason":"..."}
"""


class JudgeVerdict(StrEnum):
    FIXABLE = "fixable"
    NOT_FIXABLE = "not_fixable"
    UNCERTAIN = "uncertain"


class JudgeConfidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class JudgeResponse(BaseModel):
    verdict: JudgeVerdict
    confidence: JudgeConfidence
    reason: str = Field(min_length=1, max_length=2048)


def _eligible_rows(organization_id: int):
    return (
        SeerAutofixIssueData.objects.filter(
            organization_id=organization_id,
            judge_review__isnull=True,
            group__seer_fixability_score__isnull=False,
        )
        .exclude(raw_issue_data__status="pr_merged")
        .select_related("group")
        .annotate(
            score_percentile=Window(
                expression=PercentRank(),
                order_by=F("group__seer_fixability_score").asc(),
            )
        )
    )


def _select_candidates(organization_id: int) -> list[SeerAutofixIssueData]:
    rows = _eligible_rows(organization_id)
    bottom = list(
        rows.filter(score_percentile__lte=0.1).order_by("group__seer_fixability_score", "id")[
            :BOTTOM_SAMPLE_SIZE
        ]
    )
    middle = list(
        rows.filter(score_percentile__gte=0.4, score_percentile__lte=0.6).order_by("?")[
            :MIDDLE_SAMPLE_SIZE
        ]
    )
    top = list(rows.filter(score_percentile__gte=0.9).order_by("?")[:TOP_SAMPLE_SIZE])
    return [*bottom, *middle, *top]


def _dispatch_rate_limited(organization_id: int) -> bool:
    return ratelimiter.is_limited(
        f"autofix_issue_data_judge:org:{organization_id}",
        limit=MAX_REVIEWS_PER_ORG_PER_DAY,
        window=RATE_LIMIT_WINDOW,
    )


@instrumented_task(
    name="sentry.tasks.seer.autofix_issue_data.schedule_judging_for_org",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def schedule_judging_for_org(organization_id: int) -> None:
    organization = Organization.objects.filter(id=organization_id).first()
    if organization is None or not features.has(FEATURE_FLAG, organization):
        return

    for issue_data in _select_candidates(organization.id):
        event_id = issue_data.raw_issue_data.get("event_id")
        if not isinstance(event_id, str):
            continue
        if _dispatch_rate_limited(organization.id):
            break
        judge_issue_data.apply_async(
            args=[issue_data.id, event_id],
            headers={"sentry-propagate-traces": False},
        )


def _parse_response(content: str) -> JudgeResponse:
    value = content.strip()
    if value.startswith("```json") and value.endswith("```"):
        value = value[7:-3].strip()
    return JudgeResponse.parse_obj(json.loads(value))


def _build_prompt(issue_data: SeerAutofixIssueData) -> str:
    return json.dumps(
        {
            key: value
            for key, value in issue_data.raw_issue_data.items()
            if key not in {"status", "reason"}
        }
    )


@instrumented_task(
    name="sentry.tasks.seer.autofix_issue_data.judge",
    namespace=seer_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=2, delay=30, on=(Exception,)),
)
def judge_issue_data(issue_data_id: int, event_id: str) -> None:
    issue_data = (
        SeerAutofixIssueData.objects.select_related("organization").filter(id=issue_data_id).first()
    )
    if issue_data is None or not features.has(FEATURE_FLAG, issue_data.organization):
        return
    if issue_data.judge_review is not None:
        return
    if issue_data.raw_issue_data.get("event_id") != event_id:
        metrics.incr("autofix_issue_data.judge.skipped", tags={"reason": "stale_event"})
        return

    body = LlmGenerateRequest(
        provider="anthropic",
        model="opus",
        referrer="sentry.autofix_issue_data.judge",
        prompt=_build_prompt(issue_data),
        system_prompt=SYSTEM_PROMPT,
        temperature=0.0,
        max_tokens=1000,
        timeout=25,
        reasoning="high",
        conversation_id=None,
    )
    response = make_llm_generate_request(
        body,
        timeout=30,
        viewer_context=SeerViewerContext(organization_id=issue_data.organization_id),
    )
    if response.status >= 400:
        raise SeerApiError("Seer autofix issue data judge request failed", response.status)

    response_data: dict[str, Any] = response.json()
    content = response_data.get("content")
    model = response_data.get("model")
    if not isinstance(content, str) or not isinstance(model, str):
        raise ValueError("Seer autofix issue data judge returned an invalid response")
    result = _parse_response(content)
    reviewed_at = timezone.now()

    updated = SeerAutofixIssueData.objects.filter(
        id=issue_data.id,
        judge_review__isnull=True,
        raw_issue_data__event_id=event_id,
    ).update(
        judge_review={
            "reviewer": "llm_judge",
            "verdict": result.verdict.value,
            "confidence": result.confidence.value,
            "reason": result.reason,
            "model": model,
            "prompt_version": PROMPT_VERSION,
            "reviewed_at": reviewed_at.isoformat(),
            "reviewed_event_id": event_id,
        },
        date_updated=reviewed_at,
    )
    metrics.incr(
        "autofix_issue_data.judge.completed" if updated else "autofix_issue_data.judge.skipped",
        tags={} if updated else {"reason": "stale_event"},
    )
