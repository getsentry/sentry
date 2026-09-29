"""Tests for sentry.tasks.seer.agentic_triage.cron."""
from __future__ import annotations

from unittest.mock import patch

from sentry.tasks.seer.agentic_triage.cron import (
    EligibleProject,
    SeerAgenticTriageRunOptions,
    _build_shard_plans,
    _strip_null,
)
from sentry.tasks.seer.agentic_triage.models import TriageAction
from sentry.tasks.seer.agentic_triage.simple_triage import ScoredCandidate
from sentry.testutils.cases import TestCase

# ---------------------------------------------------------------------------
# _strip_null unit tests
# ---------------------------------------------------------------------------


def test_strip_null_removes_null_bytes() -> None:
    assert _strip_null("hello\x00world") == "helloworld"


def test_strip_null_removes_multiple_null_bytes() -> None:
    assert _strip_null("\x00foo\x00bar\x00") == "foobar"


def test_strip_null_no_null_bytes_unchanged() -> None:
    assert _strip_null("clean string") == "clean string"


def test_strip_null_none_returns_none() -> None:
    assert _strip_null(None) is None


def test_strip_null_empty_string() -> None:
    assert _strip_null("") == ""


# ---------------------------------------------------------------------------
# _build_shard_plans null-byte regression test
# ---------------------------------------------------------------------------


class TestBuildShardPlansStripNullBytes(TestCase):
    """Regression: group.title / culprit containing \\x00 must be stripped
    before the payload is serialised into the jsonb extras column."""

    def _make_resolved_options(self) -> SeerAgenticTriageRunOptions:
        return SeerAgenticTriageRunOptions(
            source="cron",
            max_candidates=10,
            intelligence_level="medium",
            reasoning_effort="medium",
            extra_triage_instructions="hint\x00with\x00nulls",
        )

    def test_null_bytes_stripped_from_title_and_culprit(self) -> None:
        organization = self.create_organization()
        project = self.create_project(organization=organization)

        # Build a real Group whose title and culprit contain null bytes.
        group = self.create_group(
            project=project,
            message="DataError\x00 in query",
        )
        # Manually set culprit with a null byte (create_group doesn't expose it).
        group.culprit = "module\x00.function"
        group.title = "DataError\x00 in query"

        candidate = ScoredCandidate(
            group=group,
            fixability=0.75,
            times_seen=10,
            action=TriageAction.AUTOFIX,
        )

        from sentry.seer.autofix.constants import AutofixStoppingPoint
        from sentry.tasks.seer.agentic_triage.tweaks import AgenticTriageTweaks

        eligible = [
            EligibleProject(
                project=project,
                tweaks=AgenticTriageTweaks(),
                stopping_point=AutofixStoppingPoint.AUTOFIX,
                connected_repos=[],
                automation_tuning=None,
            )
        ]

        # Patch the scoring strategy so we control the candidates returned.
        with patch(
            "sentry.tasks.seer.agentic_triage.cron.fixability_score_strategy",
            return_value=[candidate],
        ):
            shard_plans, num_scored = _build_shard_plans(
                organization=organization,
                eligible=eligible,
                resolved_options=self._make_resolved_options(),
            )

        assert num_scored == 1
        assert len(shard_plans) == 1

        extras = shard_plans[0].to_extras()
        # Serialise to a string so we can check for null bytes globally.
        import json

        serialised = json.dumps(extras)
        assert "\x00" not in serialised, "Null bytes found in shard plan payload"
        assert "\\u0000" not in serialised, "Unicode null escapes found in shard plan payload"

        # Verify field values specifically.
        payload = extras["payload"]
        assert isinstance(payload, dict)
        first_candidate = payload["candidates"][0]
        assert first_candidate["title"] == "DataError in query"
        assert first_candidate["culprit"] == "module.function"

        tweaks = payload["tweaks"]
        assert tweaks["extra_triage_instructions"] == "hintwithnulls"
