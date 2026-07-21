from unittest.mock import MagicMock, patch

from sentry.seer.autofix.pr_iteration.reviewer_candidates import (
    REVIEWER_CANDIDATES_EXTRA,
    SOURCE_TRIGGERING_USER,
    ReviewerCandidate,
    collect_reviewer_candidates,
    get_reviewer_candidates_marker,
    record_reviewer_candidates_marker,
)
from sentry.testutils.cases import TestCase

CANDIDATES_PATH = "sentry.seer.autofix.pr_iteration.reviewer_candidates"

RUN_ID = 67890
REPO_NAME = "owner/repo"


class CollectReviewerCandidatesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _collect(self, **kwargs) -> list[ReviewerCandidate]:
        return collect_reviewer_candidates(
            organization=self.organization,
            seer_run=self.seer_run,
            log_extra={},
            **kwargs,
        )

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="trigger-dev")
    def test_triggering_user_is_the_candidate(self, _mock_username: MagicMock) -> None:
        assert self._collect() == [
            ReviewerCandidate(login="trigger-dev", source=SOURCE_TRIGGERING_USER)
        ]

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value=None)
    def test_empty_when_no_source_resolves(self, _mock_username: MagicMock) -> None:
        assert self._collect() == []

    def test_empty_for_run_without_user(self) -> None:
        self.seer_run.update(user_id=None)
        assert self._collect() == []

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="renovate[bot]")
    def test_filters_bot_logins(self, _mock_username: MagicMock) -> None:
        assert self._collect() == []

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="trigger-dev")
    def test_excludes_given_logins(self, _mock_username: MagicMock) -> None:
        assert self._collect(exclude_logins={"Trigger-Dev"}) == []

    @patch(f"{CANDIDATES_PATH}.metrics")
    @patch(
        f"{CANDIDATES_PATH}.get_github_username_for_user", side_effect=Exception("identity down")
    )
    def test_failing_source_is_counted_not_raised(
        self, _mock_username: MagicMock, mock_metrics: MagicMock
    ) -> None:
        assert self._collect() == []
        mock_metrics.incr.assert_any_call(
            "autofix.pr_iteration.reviewer_candidates.source_failed",
            tags={"source": SOURCE_TRIGGERING_USER},
        )


class ReviewerCandidatesMarkerTest(TestCase):
    def test_roundtrip(self) -> None:
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=RUN_ID)
        # Provenance is opaque at the marker layer — any source label roundtrips.
        candidates = [
            ReviewerCandidate(login="reviewer-one", source="source-one"),
            ReviewerCandidate(login="reviewer-two", source="source-two"),
        ]

        record_reviewer_candidates_marker(
            seer_run, REPO_NAME, head_sha="abc", candidates=candidates
        )

        seer_run.refresh_from_db()
        marker = get_reviewer_candidates_marker(seer_run, REPO_NAME)
        assert marker is not None
        assert marker["head_sha"] == "abc"
        assert marker["computed_at"]
        assert marker["candidates"] == [
            {"login": "reviewer-one", "source": "source-one"},
            {"login": "reviewer-two", "source": "source-two"},
        ]
        assert (seer_run.extras or {}).get(REVIEWER_CANDIDATES_EXTRA, {}).get(REPO_NAME) == marker
