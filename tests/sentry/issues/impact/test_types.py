from __future__ import annotations

import pytest
from pydantic import ValidationError

from sentry.issues.impact.types import SeerImpactAssessmentResponse


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
