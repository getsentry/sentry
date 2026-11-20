from __future__ import annotations

from pathlib import Path
from typing import Any, get_args

import pytest
from pydantic import ValidationError

import sentry.seer
from sentry.issues.impact.types import (
    CitationEventFocus,
    CitationKind,
    CitationLocator,
    SeerImpactAssessmentResponse,
    StoredCitation,
)
from sentry.utils import json


@pytest.mark.parametrize("score", [-0.01, 100.01])
def test_seer_response_rejects_out_of_range_score(score: float) -> None:
    with pytest.raises(ValidationError):
        SeerImpactAssessmentResponse(
            score=score,
            description="Users cannot view monitor details.",
            citations=[
                {
                    "source": "event",
                    "reference": "entire-event:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "claim": "The monitor details operation failed.",
                }
            ],
        )


def test_seer_response_accepts_multiple_citations() -> None:
    response = SeerImpactAssessmentResponse(
        score=50,
        description="Users cannot view monitor details.",
        citations=[
            {
                "source": "event",
                "reference": "entire-event:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "claim": "The monitor details operation failed.",
            },
            {
                "source": "trace",
                "reference": "trace:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "claim": "The trace also contains a failure.",
            },
        ],
    )

    assert len(response.citations) == 2


def _schema_branches() -> list[dict[str, Any]]:
    return json.loads((Path(sentry.seer.__file__).parent / "citations.generated.json").read_text())[
        "oneOf"
    ]


def test_stored_citation_kinds_match_schema() -> None:
    kinds = [branch["properties"]["kind"]["const"] for branch in _schema_branches()]
    assert set(get_args(CitationKind)) == set(kinds)


def test_stored_citation_covers_every_locator_field() -> None:
    def fields(schema: dict[str, Any]) -> set[str]:
        options = schema.get("anyOf") or [schema]
        return {key for option in options for key in option.get("properties", {})}

    locator_fields = set().union(
        *(fields(branch["properties"]["locator"]) for branch in _schema_branches())
    )
    assert locator_fields <= set(CitationLocator.__fields__)

    focus_fields = set().union(
        *(
            fields(branch["properties"]["locator"]["properties"]["focus"])
            for branch in _schema_branches()
            if "focus" in branch["properties"]["locator"]["properties"]
        )
    )
    assert focus_fields <= set(CitationEventFocus.__fields__)


def test_stored_citation_round_trips() -> None:
    citation = {
        "id": "c_users001",
        "kind": "issue",
        "title": "SHOP-1: 903 users",
        "projectId": "1",
        "locator": {"groupId": "123", "stat": {"name": "users", "value": 903}},
    }
    assert StoredCitation.parse_obj(citation).to_api() == citation
    as_string = {
        **citation,
        "locator": {"groupId": "123", "stat": {"name": "events", "value": "4112"}},
    }
    assert StoredCitation.parse_obj(as_string).to_api() == as_string
