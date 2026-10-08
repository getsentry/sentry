from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from sentry.api.serializers import EventSerializer, serialize
from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.limits import LIMITS_LOW
from sentry.issues.formatting.models import EventObject, ExceptionDetails, Frame
from sentry.issues.impact.types import (
    MAX_CONTEXT_LINES,
    MAX_EVIDENCE_ITEMS,
    MAX_FRAMES,
    MAX_IMPACT_INPUT_BYTES,
    ImpactAssessmentInput,
    ImpactEvidenceItem,
    ImpactException,
    ImpactFrame,
    ImpactOccurrenceEvidence,
    ImpactTraceContext,
    ProjectImpactContext,
)
from sentry.services.eventstore.models import BaseEvent
from sentry.utils import json
from sentry.utils.strings import truncatechars


def _text(value: object) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    assert LIMITS_LOW.max_evidence_chars is not None
    return truncatechars(value, LIMITS_LOW.max_evidence_chars)


def _url_without_query(value: object) -> str | None:
    url = _text(value)
    if url is None:
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    return _text(urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")))


def _source_context(frame: Frame) -> tuple[list[str], str | None, list[str]]:
    if frame.line_no is None:
        return [], None, []
    before = [source for line, source in frame.context if line < frame.line_no and source]
    current = next(
        (source for line, source in frame.context if line == frame.line_no and source), None
    )
    after = [source for line, source in frame.context if line > frame.line_no and source]
    return before[-MAX_CONTEXT_LINES:], current, after[:MAX_CONTEXT_LINES]


def _exception_and_frames(
    model: EventObject,
) -> tuple[ImpactException | None, str | None, bool | None, list[ImpactFrame]]:
    if not model.exceptions:
        return None, None, None, []

    exception: ExceptionDetails = model.exceptions[-1]
    frames = []
    if exception.stacktrace is not None:
        in_app_frames = [frame for frame in exception.stacktrace.frames if frame.in_app is True]
        for index, frame in enumerate(in_app_frames[-MAX_FRAMES:]):
            pre_context, context_line, post_context = _source_context(frame)
            frames.append(
                ImpactFrame(
                    id=f"frame-{index}",
                    function=_text(frame.function),
                    filename=_text(frame.filename),
                    module=_text(frame.module),
                    pre_context=pre_context,
                    context_line=context_line,
                    post_context=post_context,
                )
            )

    return (
        ImpactException(type=_text(exception.type), value=_text(exception.value)),
        _text(exception.mechanism_type),
        exception.is_handled,
        frames,
    )


def _component_stack(contexts: Mapping[str, Mapping[str, Any]]) -> list[str]:
    react = contexts.get("react") or {}
    value = react.get("component_stack") or react.get("componentStack")
    if isinstance(value, str):
        components = [line.strip() for line in value.splitlines() if line.strip()]
    elif isinstance(value, Sequence) and not isinstance(value, bytes):
        components = [item for item in value if isinstance(item, str) and item]
    else:
        return []
    return [component for item in components[:MAX_EVIDENCE_ITEMS] if (component := _text(item))]


def _trace_context(contexts: Mapping[str, Mapping[str, Any]]) -> ImpactTraceContext | None:
    trace = contexts.get("trace") or {}
    context = ImpactTraceContext(
        op=_text(trace.get("op")),
        status=_text(trace.get("status")),
        description=_text(trace.get("description")),
    )
    return context if any(context.dict().values()) else None


def create_event_object(event: BaseEvent) -> EventObject:
    # For the prototype, reuse the established API serializer and formatter adapter instead of
    # maintaining a second BaseEvent adapter. This serializes fields Impact does not consume and
    # may perform extra work such as crash-file lookup. If assessment moves to a high-volume path,
    # replace this round trip with a measured, shared BaseEvent adapter.
    serialized = serialize(event, serializer=EventSerializer())
    return event_response_to_model(serialized)


def _build_occurrence_evidence(event: BaseEvent) -> ImpactOccurrenceEvidence:
    eo = create_event_object(event)
    exception, mechanism, handled, frames = _exception_and_frames(eo)
    component_stack = _component_stack(eo.contexts)
    trace = _trace_context(eo.contexts)
    replay_available = bool(
        (eo.contexts.get("replay") or {}).get("replay_id")
        or event.get_tag("replayId")
        or event.get_tag("replay_id")
    )
    evidence = [
        ImpactEvidenceItem(name=name, value=value)
        for name, value in eo.evidence[:MAX_EVIDENCE_ITEMS]
    ]
    culprit = _text(event.culprit)
    transaction = _text(event.transaction)
    url = _url_without_query(eo.request.url if eo.request else None)
    platform = _text(event.platform)
    environment = _text(event.get_tag("environment"))
    release = _text(event.release)
    evidence_ids = [
        name
        for name, value in (
            ("exception", exception),
            ("culprit", culprit),
            ("transaction", transaction),
            ("url", url),
            ("platform", platform),
            ("environment", environment),
            ("release", release),
            ("mechanism", mechanism),
            ("replay", replay_available or None),
        )
        if value is not None
    ]
    evidence_ids.extend(frame.id for frame in frames)
    if component_stack:
        evidence_ids.append("component_stack")
    if trace is not None:
        evidence_ids.append("trace")
    if evidence:
        evidence_ids.append("issue_evidence")

    return ImpactOccurrenceEvidence(
        title=_text(eo.occurrence_title or eo.title) or "",
        subtitle=_text(eo.subtitle),
        exception=exception,
        culprit=culprit,
        transaction=transaction,
        url=url,
        platform=platform,
        environment=environment,
        release=release,
        mechanism=mechanism,
        handled=handled,
        frames=frames,
        component_stack=component_stack,
        trace=trace,
        replay_available=replay_available,
        evidence=evidence,
        evidence_ids=evidence_ids,
    )


def build_impact_assessment_input(
    event: BaseEvent,
    project_context: ProjectImpactContext | None = None,
) -> ImpactAssessmentInput:
    """Build the bounded, deterministic input shared by all Impact assessors."""

    occurrence = _build_occurrence_evidence(event)
    fingerprint_data = {
        "issue_evidence": occurrence.dict(exclude_none=True),
        "project_context": project_context.dict(exclude_none=True) if project_context else None,
    }
    serialized = json.dumps(fingerprint_data, sort_keys=True).encode()
    if len(serialized) > MAX_IMPACT_INPUT_BYTES:
        raise ValueError(f"Impact assessment input exceeds {MAX_IMPACT_INPUT_BYTES} bytes")
    fingerprint = hashlib.sha256(serialized).hexdigest()
    return ImpactAssessmentInput(
        issue_evidence=occurrence,
        project_context=project_context,
        fingerprint=fingerprint,
    )
