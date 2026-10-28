from datetime import UTC, datetime
from typing import Any

from sentry.notifications.platform.templates.seer import SeerInvestigationStatus
from sentry.seer.entrypoints.slack.investigation_status import build_investigation_status
from sentry.testutils.cases import TestCase


def _hypothesis(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "h1",
        "order": 0,
        "generation": 1,
        "statement": "Database or cache degradation delayed the response",
        "rationale": "Server response time rose with the breach.",
        "effectiveStatus": "investigating",
        "agentVerdict": None,
        "verificationSteps": [
            {"id": "s1", "order": 0, "title": "Read the error logs", "status": "completed"},
            {"id": "s2", "order": 1, "title": "Compare cache behavior", "status": "running"},
        ],
        **overrides,
    }


class BuildInvestigationStatusTest(TestCase):
    def setUp(self) -> None:
        self.investigation = self.create_notebook(
            organization=self.organization,
            source={
                "type": "metric_open_period",
                "snapshot": {
                    "groupTitle": "Login page FCP spike",
                    "monitor": {
                        "name": "FCP on organization login pages",
                        "query": "transaction:/auth/login/[org]/",
                    },
                    "analysisWindow": {
                        "breachStart": "2024-08-27T09:00:00+00:00",
                        "end": "2024-08-27T11:00:00+00:00",
                    },
                },
            },
        )

    def _snapshot(self) -> dict[str, Any]:
        return self.investigation.source["snapshot"]

    def _build(
        self, hypotheses: list[dict[str, Any]], updated_at: datetime | None = None
    ) -> tuple[SeerInvestigationStatus, str]:
        return build_investigation_status(
            investigation=self.investigation,
            projection={"hypotheses": hypotheses},
            updated_at=updated_at,
        )

    def test_builds_status_from_projection(self) -> None:
        data, _fingerprint = self._build([_hypothesis()])

        assert data.organization_id == self.organization.id
        assert data.title == "FCP on organization login pages"
        assert data.subtitle == "`/auth/login/[org]/` · Aug 27, 09:00–11:00 UTC"
        assert data.investigation_url == self.investigation.get_absolute_url()
        assert data.hypotheses == [
            {
                "statement": "Database or cache degradation delayed the response",
                "label": "● Verifying",
                "detail": "Compare cache behavior",
            }
        ]

    def test_no_projection_has_no_hypotheses(self) -> None:
        data, _fingerprint = build_investigation_status(
            investigation=self.investigation, projection=None
        )

        assert data.hypotheses == []

    def test_fingerprint_changes_only_with_what_is_shown(self) -> None:
        _data, fingerprint = self._build([_hypothesis()])

        assert self._build([_hypothesis()])[1] == fingerprint
        assert self._build([_hypothesis(rationale="Unused")])[1] == fingerprint
        assert self._build([_hypothesis(statement="Revised")])[1] != fingerprint

    def test_window_ends_at_latest_update(self) -> None:
        data, _fingerprint = self._build(
            [_hypothesis()], updated_at=datetime(2024, 8, 27, 11, 25, tzinfo=UTC)
        )

        assert data.subtitle is not None
        assert data.subtitle.endswith("Aug 27, 09:00–11:25 UTC")

    def test_verdict_rationale_replaces_step_detail_and_is_truncated(self) -> None:
        data, _fingerprint = self._build(
            [
                _hypothesis(
                    id="h1",
                    order=0,
                    effectiveStatus="supported",
                    agentVerdict={"verdict": "supported", "rationale": "x" * 400},
                ),
                _hypothesis(
                    id="h2",
                    order=1,
                    effectiveStatus="supported",
                    agentVerdict={"verdict": "supported", "rationale": ""},
                    verificationSteps=[
                        {"id": "s1", "order": 0, "title": "Query traces", "status": "blocked"}
                    ],
                ),
            ]
        )

        assert [(hypothesis["label"], hypothesis["detail"]) for hypothesis in data.hypotheses] == [
            ("● Supported", "x" * 299 + "…"),
            ("● Supported", "Blocked: Query traces"),
        ]

    def test_user_disposition_and_terminal_statuses_map_to_labels(self) -> None:
        data, _fingerprint = self._build(
            [
                _hypothesis(id="h1", order=0, effectiveStatus="accepted"),
                _hypothesis(id="h2", order=1, effectiveStatus="rejected"),
                _hypothesis(id="h3", order=2, effectiveStatus="failed"),
                _hypothesis(id="h4", order=3, effectiveStatus="cancelled"),
                _hypothesis(id="h5", order=4, effectiveStatus="inconclusive"),
            ]
        )

        assert [hypothesis["label"] for hypothesis in data.hypotheses] == [
            "● Supported",
            "● Refuted",
            "● Not completed",
            "● Not completed",
            "● Inconclusive",
        ]
        assert data.hypotheses[2]["detail"] == (
            "Verification stopped before this explanation could be assessed."
        )

    def test_teammate_decision_replaces_seer_verdict(self) -> None:
        data, _fingerprint = self._build(
            [
                _hypothesis(
                    id="h1",
                    order=0,
                    effectiveStatus="accepted",
                    decisionSource="user",
                    agentVerdict={"verdict": "refuted", "rationale": "Timings did not change."},
                    userDisposition={"disposition": "accepted"},
                ),
                _hypothesis(
                    id="h2",
                    order=1,
                    effectiveStatus="rejected",
                    decisionSource="user",
                    userDisposition={"disposition": "rejected"},
                ),
            ]
        )

        assert [(hypothesis["label"], hypothesis["detail"]) for hypothesis in data.hypotheses] == [
            ("● Accepted by a teammate", "A teammate made this call in Sentry."),
            ("● Rejected by a teammate", "A teammate made this call in Sentry."),
        ]

    def test_hypotheses_sorted_by_order_and_detail_falls_back_to_rationale(self) -> None:
        data, _fingerprint = self._build(
            [
                _hypothesis(id="h2", order=1, statement="Second", verificationSteps=[]),
                _hypothesis(id="h1", order=0, statement="First"),
            ]
        )

        assert [hypothesis["statement"] for hypothesis in data.hypotheses] == ["First", "Second"]
        assert data.hypotheses[1]["detail"] == "Server response time rose with the breach."

    def test_stuck_step_is_named_instead_of_rationale(self) -> None:
        data, _fingerprint = self._build(
            [
                _hypothesis(
                    id=f"h{order}",
                    order=order,
                    verificationSteps=[
                        {"id": "s1", "order": 0, "title": "Query traces", "status": status},
                        {"id": "s2", "order": 1, "title": "Read the logs", "status": "queued"},
                    ],
                )
                for order, status in enumerate(("reauth_required", "blocked", "stalled"))
            ]
        )

        assert [hypothesis["detail"] for hypothesis in data.hypotheses] == [
            "Needs re-authentication: Query traces",
            "Blocked: Query traces",
            "Stalled: Query traces",
        ]

    def test_hypotheses_are_capped(self) -> None:
        data, _fingerprint = self._build(
            [_hypothesis(id=f"h{order}", order=order) for order in range(12)]
        )

        assert len(data.hypotheses) == 10

    def test_subtitle_without_query_spans_days(self) -> None:
        self._snapshot()["monitor"]["query"] = ""
        self._snapshot()["analysisWindow"]["breachStart"] = "2024-08-27T23:00:00+00:00"

        data, _fingerprint = self._build(
            [_hypothesis()], updated_at=datetime(2024, 8, 28, 1, 0, tzinfo=UTC)
        )

        assert data.subtitle == "Aug 27, 23:00 – Aug 28, 01:00 UTC"

    def test_backtick_in_endpoint_is_replaced(self) -> None:
        self._snapshot()["monitor"]["query"] = "transaction:`/a&b`"

        data, _fingerprint = self._build([])

        assert data.subtitle == "`'/a&b'` · Aug 27, 09:00–11:00 UTC"

    def test_subtitle_shows_only_a_single_transaction_filter(self) -> None:
        cases = {
            "is:unresolved": "Aug 27, 09:00–11:00 UTC",
            'is:unresolved transaction:"/auth/login/"': "`/auth/login/` · Aug 27, 09:00–11:00 UTC",
            "!transaction:/health/": "Aug 27, 09:00–11:00 UTC",
            "transaction:/a/ transaction:/b/": "Aug 27, 09:00–11:00 UTC",
            "transaction:/a/ OR transaction:/b/": "Aug 27, 09:00–11:00 UTC",
            "transaction:/a/ AND user.email:x@example.com": "`/a/` · Aug 27, 09:00–11:00 UTC",
            "is:unresolved AND transaction:/a/": "`/a/` · Aug 27, 09:00–11:00 UTC",
            "(transaction:/a/ user.email:x@example.com)": "Aug 27, 09:00–11:00 UTC",
        }
        for query, subtitle in cases.items():
            self._snapshot()["monitor"]["query"] = query

            assert self._build([])[0].subtitle == subtitle, query
