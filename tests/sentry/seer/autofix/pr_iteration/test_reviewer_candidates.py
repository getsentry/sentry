from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.models.groupowner import GroupOwnerType
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.seer.autofix.pr_iteration.reviewer_candidates import (
    MAX_CANDIDATES,
    REVIEWER_CANDIDATES_EXTRA,
    SOURCE_CODE_OWNER,
    SOURCE_RECENT_COMMITTER,
    SOURCE_SUSPECT_COMMIT_AUTHOR,
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
PR_NUMBER = 42


def _files_page(files: list[dict]) -> dict:
    return {
        "data": files,
        "type": "github",
        "raw": {"headers": None, "data": None},
        "meta": {"next_cursor": None},
    }


def _commits_page(raw_commits: list[dict]) -> dict:
    return {
        "data": [],
        "type": "github",
        "raw": {"headers": None, "data": raw_commits},
        "meta": {"next_cursor": None},
    }


class _FakeScm:
    """Satisfies the runtime protocol checks; the patched ``scm_actions``
    intercepts every call, so the methods never actually run."""

    def get_pull_request_files(self, *args, **kwargs):
        raise NotImplementedError

    def get_commits_by_path(self, *args, **kwargs):
        raise NotImplementedError


class CollectReviewerCandidatesTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", name=REPO_NAME
        )
        self.seer_run = self.create_seer_run(
            organization=self.organization, seer_run_state_id=RUN_ID, user_id=self.user.id
        )

    def _collect(self, scm: Any = None, **kwargs: Any) -> list[ReviewerCandidate]:
        if scm is None:
            # A bare object supports none of the scm protocols, so the
            # file-based sources stay empty without any provider calls.
            scm = object()
        return collect_reviewer_candidates(
            organization=self.organization,
            repository=self.repo,
            seer_run=self.seer_run,
            group_id=self.group.id,
            scm=scm,
            pr_number=PR_NUMBER,
            log_extra={},
            **kwargs,
        )

    def _create_suspect_commit(self, *, external_id: str | None, user_id: int | None = None):
        author = self.create_commit_author(
            organization_id=self.organization.id, email="suspect@example.com"
        )
        author.update(external_id=external_id)
        commit = self.create_commit(repo=self.repo, author=author)
        self.create_group_owner(
            group=self.group,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=user_id,
            context={"commitId": commit.id},
        )

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="trigger-dev")
    def test_triggering_user_is_the_candidate(self, _mock_username: MagicMock) -> None:
        assert self._collect() == [
            ReviewerCandidate(login="trigger-dev", source=SOURCE_TRIGGERING_USER)
        ]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="trigger-dev")
    def test_resolvable_triggering_user_short_circuits_fan_out(
        self, _mock_username: MagicMock, mock_actions: MagicMock
    ) -> None:
        self._create_suspect_commit(external_id="github:suspect-dev")

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="trigger-dev", source=SOURCE_TRIGGERING_USER)]
        # The fallback sources cost provider calls; a resolvable triggering
        # user must not pay for them, nor ping people who didn't opt in.
        mock_actions.get_pull_request_files.assert_not_called()
        mock_actions.get_commits_by_path.assert_not_called()

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
        # An excluded triggering user counts as unresolvable, so the fan-out
        # sources still get their chance (and find nothing here).
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

    @patch(
        f"{CANDIDATES_PATH}.get_github_username_for_user", side_effect=Exception("identity down")
    )
    def test_failing_source_does_not_break_the_rest(self, _mock_username: MagicMock) -> None:
        # The triggering-user source raises, but the suspect-commit source
        # resolves without the username helper and must survive.
        self._create_suspect_commit(external_id="github:suspect-dev")

        assert self._collect() == [
            ReviewerCandidate(login="suspect-dev", source=SOURCE_SUSPECT_COMMIT_AUTHOR)
        ]

    def test_suspect_commit_author_via_commit_external_id(self) -> None:
        self.seer_run.update(user_id=None)
        self._create_suspect_commit(external_id="github:suspect-dev")

        assert self._collect() == [
            ReviewerCandidate(login="suspect-dev", source=SOURCE_SUSPECT_COMMIT_AUTHOR)
        ]

    @patch(f"{CANDIDATES_PATH}.get_github_username_for_user", return_value="matched-dev")
    def test_suspect_commit_author_falls_back_to_group_owner_user(
        self, _mock_username: MagicMock
    ) -> None:
        self.seer_run.update(user_id=None)
        self._create_suspect_commit(external_id=None, user_id=self.user.id)

        assert self._collect() == [
            ReviewerCandidate(login="matched-dev", source=SOURCE_SUSPECT_COMMIT_AUTHOR)
        ]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_code_owner_of_changed_files(self, mock_actions: MagicMock) -> None:
        self.seer_run.update(user_id=None)
        member = self.create_user(email="linked@example.com")
        self.create_member(organization=self.organization, user=member, teams=[self.team])
        self.create_external_user(
            user=member, organization=self.organization, external_name="@linked-dev"
        )
        code_mapping = self.create_code_mapping(project=self.project, repo=self.repo)
        self.create_codeowners(
            project=self.project,
            code_mapping=code_mapping,
            raw="\n".join(
                [
                    "# owners",
                    "* @owner/platform-team",
                    "src/other.py @unlinked-dev",
                    "src/widget.py @linked-dev",
                ]
            ),
        )
        mock_actions.get_pull_request_files.return_value = _files_page(
            [
                {"filename": "src/widget.py", "changes": 10},
                {"filename": "src/other.py", "changes": 5},
                {"filename": "docs/readme.md", "changes": 1},
            ]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page([])

        candidates = self._collect(scm=_FakeScm())

        # The team owning docs/readme.md and the unlinked owner of
        # src/other.py are dropped; only the linked individual owner of
        # src/widget.py remains.
        assert candidates == [ReviewerCandidate(login="linked-dev", source=SOURCE_CODE_OWNER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_code_owner_does_not_require_access_to_the_codeowners_project(
        self, mock_actions: MagicMock
    ) -> None:
        # A repo can be shared by several projects, and the owner may lack
        # Sentry team access on the one whose CODEOWNERS row we happen to
        # read. GitHub repo access is what makes them a valid reviewer, so
        # the org-wide identity link alone must suffice.
        self.seer_run.update(user_id=None)
        other_team = self.create_team(organization=self.organization)
        member = self.create_user(email="elsewhere@example.com")
        self.create_member(organization=self.organization, user=member, teams=[other_team])
        self.create_external_user(
            user=member, organization=self.organization, external_name="@elsewhere-dev"
        )
        code_mapping = self.create_code_mapping(project=self.project, repo=self.repo)
        self.create_codeowners(
            project=self.project,
            code_mapping=code_mapping,
            raw="src/widget.py @elsewhere-dev",
        )
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page([])

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="elsewhere-dev", source=SOURCE_CODE_OWNER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_code_owner_prefers_the_most_recently_synced_copy(
        self, mock_actions: MagicMock
    ) -> None:
        # Schema-only rebuilds (e.g. on team changes) bump date_updated
        # without refreshing raw, so the copy that looks newest by
        # date_updated can hold stale rules; date_synced marks when raw was
        # actually fetched.
        self.seer_run.update(user_id=None)
        for login in ("current-dev", "stale-dev"):
            member = self.create_user(email=f"{login}@example.com")
            self.create_member(organization=self.organization, user=member, teams=[self.team])
            self.create_external_user(
                user=member, organization=self.organization, external_name=f"@{login}"
            )
        synced = self.create_codeowners(
            project=self.project,
            code_mapping=self.create_code_mapping(project=self.project, repo=self.repo),
            raw="src/widget.py @current-dev",
        )
        other_project = self.create_project(organization=self.organization, teams=[self.team])
        rebuilt = self.create_codeowners(
            project=other_project,
            code_mapping=self.create_code_mapping(project=other_project, repo=self.repo),
            raw="src/widget.py @stale-dev",
        )
        now = timezone.now()
        # Queryset updates dodge the pre_save signal that would overwrite
        # date_updated with the save time.
        ProjectCodeOwners.objects.filter(id=synced.id).update(
            date_synced=now - timedelta(hours=1), date_updated=now - timedelta(hours=1)
        )
        ProjectCodeOwners.objects.filter(id=rebuilt.id).update(date_synced=None, date_updated=now)
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page([])

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="current-dev", source=SOURCE_CODE_OWNER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_code_owner_last_matching_rule_wins(self, mock_actions: MagicMock) -> None:
        self.seer_run.update(user_id=None)
        for login in ("first-dev", "second-dev"):
            member = self.create_user(email=f"{login}@example.com")
            self.create_member(organization=self.organization, user=member, teams=[self.team])
            self.create_external_user(
                user=member, organization=self.organization, external_name=f"@{login}"
            )
        code_mapping = self.create_code_mapping(project=self.project, repo=self.repo)
        self.create_codeowners(
            project=self.project,
            code_mapping=code_mapping,
            raw="src/widget.py @first-dev\nsrc/*.py @second-dev",
        )
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page([])

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="second-dev", source=SOURCE_CODE_OWNER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_code_owner_ignores_gitlab_section_syntax(self, mock_actions: MagicMock) -> None:
        # GitLab-style "[Section]" headers are not GitHub CODEOWNERS syntax;
        # GitHub ignores such lines and treats owner-less paths as un-owned.
        # Match that: the section owner is never proposed, and files under the
        # section resolve to nobody rather than to a stale earlier rule.
        self.seer_run.update(user_id=None)
        for login in ("linked-dev", "section-owner"):
            member = self.create_user(email=f"{login}@example.com")
            self.create_member(organization=self.organization, user=member, teams=[self.team])
            self.create_external_user(
                user=member, organization=self.organization, external_name=f"@{login}"
            )
        code_mapping = self.create_code_mapping(project=self.project, repo=self.repo)
        self.create_codeowners(
            project=self.project,
            code_mapping=code_mapping,
            raw="\n".join(
                [
                    "* @section-owner",
                    "src/widget.py @linked-dev",
                    "[Frontend] @section-owner",
                    "src/components/",
                ]
            ),
        )
        mock_actions.get_pull_request_files.return_value = _files_page(
            [
                {"filename": "src/widget.py", "changes": 10},
                {"filename": "src/components/app.tsx", "changes": 5},
            ]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page([])

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="linked-dev", source=SOURCE_CODE_OWNER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_recent_committers_ranked_by_frequency_and_bots_dropped(
        self, mock_actions: MagicMock
    ) -> None:
        self.seer_run.update(user_id=None)
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page(
            [
                {"author": {"login": "bob", "type": "User"}},
                {"author": {"login": "alice", "type": "User"}},
                {"author": {"login": "Alice", "type": "User"}},
                {"author": {"login": "ci-runner", "type": "Bot"}},
                {"author": {"login": "renovate[bot]", "type": "User"}},
                {"author": None},
            ]
        )

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [
            ReviewerCandidate(login="alice", source=SOURCE_RECENT_COMMITTER),
            ReviewerCandidate(login="bob", source=SOURCE_RECENT_COMMITTER),
        ]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_recent_committer_malformed_page_skips_only_that_path(
        self, mock_actions: MagicMock
    ) -> None:
        self.seer_run.update(user_id=None)
        mock_actions.get_pull_request_files.return_value = _files_page(
            [
                {"filename": "src/widget.py", "changes": 10},
                {"filename": "src/other.py", "changes": 5},
            ]
        )
        malformed_page = {"data": [], "type": "github", "raw": {}, "meta": {"next_cursor": None}}
        mock_actions.get_commits_by_path.side_effect = [
            malformed_page,
            _commits_page([{"author": {"login": "alice", "type": "User"}}]),
        ]

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="alice", source=SOURCE_RECENT_COMMITTER)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_dedupes_fallback_sources_keeping_highest_ranked_provenance(
        self, mock_actions: MagicMock
    ) -> None:
        self.seer_run.update(user_id=None)
        self._create_suspect_commit(external_id="github:alice")
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page(
            [{"author": {"login": "Alice", "type": "User"}}]
        )

        candidates = self._collect(scm=_FakeScm())

        assert candidates == [ReviewerCandidate(login="alice", source=SOURCE_SUSPECT_COMMIT_AUTHOR)]

    @patch(f"{CANDIDATES_PATH}.scm_actions")
    def test_caps_candidate_list(self, mock_actions: MagicMock) -> None:
        self.seer_run.update(user_id=None)
        mock_actions.get_pull_request_files.return_value = _files_page(
            [{"filename": "src/widget.py", "changes": 10}]
        )
        mock_actions.get_commits_by_path.return_value = _commits_page(
            [{"author": {"login": f"dev-{i}", "type": "User"}} for i in range(MAX_CANDIDATES + 3)]
        )

        assert len(self._collect(scm=_FakeScm())) == MAX_CANDIDATES


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
