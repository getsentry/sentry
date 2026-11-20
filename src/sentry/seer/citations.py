"""
Validation for citations Seer attaches to its results.

Seer's tools record a citation for each piece of user data they read, and the
agent cites them by id. The shape is defined by the frontend, which renders
them, in ``static/app/components/seer/citations/schemas.ts`` and exported to
``citations.generated.json`` by ``pnpm gen:citations``. Do not edit that file
by hand.

Citations come from an LLM-driven run, so treat them as untrusted input:
anything that doesn't match the schema is downgraded or dropped, and
citations pointing at projects outside the organization are dropped. The UI
still loads every cited object through organization-scoped APIs.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Sequence
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from sentry.models.project import Project
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

MAX_CITATIONS = 64

_SCHEMA_PATH = Path(__file__).parent / "citations.generated.json"


@cache
def _schema() -> dict[str, Any]:
    return json.loads(_SCHEMA_PATH.read_text())


@cache
def _validator() -> Draft202012Validator:
    return Draft202012Validator(_schema())


def citation_kinds() -> frozenset[str]:
    return frozenset(_schema()["kinds"])


def citation_schema_version() -> int:
    return int(_schema()["version"])


def is_valid_citation(citation: Any) -> bool:
    return _validator().is_valid(citation)


def _as_external(citation: Any) -> dict[str, Any] | None:
    """Keep a citation Sentry can't render richly as a plain link, when it has one."""
    if not isinstance(citation, dict):
        return None
    url = citation.get("url")
    if not isinstance(url, str):
        return None
    external: dict[str, Any] = {
        "id": citation.get("id"),
        "kind": "external",
        "title": citation.get("title"),
        "url": url,
        "locator": {"url": url, "source": str(citation.get("kind", ""))[:64] or None},
    }
    if external["locator"]["source"] is None:
        del external["locator"]["source"]
    for key in ("excerpt", "observedAt"):
        if key in citation:
            external[key] = citation[key]
    return external if is_valid_citation(external) else None


def validate_citations(
    citations: Iterable[Any], *, organization_id: int, referrer: str
) -> list[dict[str, Any]]:
    """
    Return the citations safe to store and render, in their original order.

    - Valid citations are kept as-is.
    - Invalid ones with a URL are downgraded to ``external``; the rest are dropped.
    - Citations naming a project outside the organization are dropped.
    - Duplicate ids keep their first occurrence; at most ``MAX_CITATIONS`` are kept.
    """
    kept: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    dropped = downgraded = 0

    for citation in citations:
        if len(kept) >= MAX_CITATIONS:
            dropped += 1
            continue
        if not is_valid_citation(citation):
            citation = _as_external(citation)
            if citation is None:
                dropped += 1
                continue
            downgraded += 1
        if citation["id"] in seen_ids:
            continue
        seen_ids.add(citation["id"])
        kept.append(citation)

    project_ids = {int(c["projectId"]) for c in kept if "projectId" in c}
    if project_ids:
        allowed = set(
            Project.objects.filter(id__in=project_ids, organization_id=organization_id).values_list(
                "id", flat=True
            )
        )
        before = len(kept)
        kept = [c for c in kept if "projectId" not in c or int(c["projectId"]) in allowed]
        dropped += before - len(kept)

    tags = {"referrer": referrer}
    metrics.incr("seer.citations.kept", amount=len(kept), tags=tags, sample_rate=1.0)
    if dropped:
        metrics.incr("seer.citations.dropped", amount=dropped, tags=tags, sample_rate=1.0)
    if downgraded:
        metrics.incr("seer.citations.downgraded", amount=downgraded, tags=tags, sample_rate=1.0)
    return kept


def citations_by_id(citations: Sequence[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {c["id"]: c for c in citations}
