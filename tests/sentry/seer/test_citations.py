from typing import Any

from sentry.seer.citations import (
    MAX_CITATIONS,
    citation_kinds,
    is_valid_citation,
    validate_citations,
)
from sentry.testutils.cases import TestCase

EVENT_ID = "8f2c1a9d7e6b4f30a1b2c3d4e5f60718"


def frame_citation(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "c_frame01",
        "kind": "event",
        "title": "submitOrder in checkout.ts",
        "locator": {
            "eventId": EVENT_ID,
            "focus": {"type": "frame", "exceptionIndex": 0, "frameIndex": 4},
        },
        **overrides,
    }


class CitationSchemaTest(TestCase):
    def test_kinds_come_from_generated_schema(self) -> None:
        assert {"event", "trace", "log", "replay", "query", "code", "external"} <= citation_kinds()

    def test_valid_and_invalid(self) -> None:
        assert is_valid_citation(frame_citation())
        assert not is_valid_citation(frame_citation(locator={"eventId": "nope"}))
        assert not is_valid_citation(frame_citation(kind="tweet"))
        assert not is_valid_citation(frame_citation(id="frame"))
        assert not is_valid_citation("c_frame01")


class ValidateCitationsTest(TestCase):
    def validate(self, citations: list[Any]) -> list[dict[str, Any]]:
        return validate_citations(citations, organization_id=self.organization.id, referrer="test")

    def test_keeps_valid_citations_in_order(self) -> None:
        trace = {
            "id": "c_span01",
            "kind": "trace",
            "title": "POST /checkout",
            "locator": {"traceId": "a1b2c3d4e5f678901234567890abcdef"},
        }
        assert self.validate([trace, frame_citation()]) == [trace, frame_citation()]

    def test_downgrades_unrenderable_citation_with_url(self) -> None:
        citation = {
            "id": "c_slack01",
            "kind": "slackMessage",
            "title": "Thread in #incidents",
            "url": "https://example.slack.com/archives/C1/p1",
            "excerpt": "checkout is down",
        }
        assert self.validate([citation]) == [
            {
                "id": "c_slack01",
                "kind": "external",
                "title": "Thread in #incidents",
                "url": "https://example.slack.com/archives/C1/p1",
                "excerpt": "checkout is down",
                "locator": {
                    "url": "https://example.slack.com/archives/C1/p1",
                    "source": "slackMessage",
                },
            }
        ]

    def test_drops_invalid_citation_without_url(self) -> None:
        assert self.validate([frame_citation(locator={}), None, 42]) == []

    def test_dedupes_by_id(self) -> None:
        assert self.validate([frame_citation(), frame_citation(title="again")]) == [
            frame_citation()
        ]

    def test_drops_citations_from_other_organizations(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        mine = frame_citation(projectId=str(self.project.id))
        theirs = frame_citation(id="c_frame02", projectId=str(other_project.id))
        missing = frame_citation(id="c_frame03", projectId="999999999")
        assert self.validate([mine, theirs, missing]) == [mine]

    def test_caps_count(self) -> None:
        citations = [frame_citation(id=f"c_{i:04d}") for i in range(MAX_CITATIONS + 5)]
        assert len(self.validate(citations)) == MAX_CITATIONS
