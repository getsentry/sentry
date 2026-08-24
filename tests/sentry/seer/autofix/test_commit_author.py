from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser

from sentry.integrations.types import ExternalProviders
from sentry.seer.autofix.commit_author import (
    commit_author_for_feedback,
    commit_author_for_github_actor,
    commit_author_for_user,
    parse_commit_author,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubIssueComment,
    GithubPrCommentFeedbackSource,
    GithubPrCommentUser,
    GithubPrReviewBodyFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.testutils.cases import TestCase

OCTOCAT_EMAIL = "583231+octocat@users.noreply.github.com"
LOGIN_ONLY_EMAIL = "octocat@users.noreply.github.com"
METRICS_PATH = "sentry.seer.autofix.commit_author.metrics"


def check_suite_feedback() -> Feedback:
    return Feedback(
        source=CheckSuiteFeedbackSource(
            event={
                "check_suite": {
                    "id": 1,
                    "head_sha": "abc123",
                    "conclusion": "failure",
                    "app": {"name": "GitHub Actions"},
                    "check_runs_url": "https://api.github.com/check-runs",
                },
                "repository": {
                    "full_name": "owner/repo",
                    "html_url": "https://github.com/owner/repo",
                },
            }
        )
    )


def comment_feedback(
    login: str | None, user_id: int | None = None, comment_id: int = 10
) -> Feedback:
    return Feedback(
        source=GithubPrCommentFeedbackSource(
            comment=GithubIssueComment(
                id=comment_id,
                body="@sentry fix it",
                user=GithubPrCommentUser(id=user_id, login=login) if login else None,
            ),
            repo_name="owner/repo",
        )
    )


class CommitAuthorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.actor = self.create_user(name="Mona Lisa")

    def _link_github(self, external_id: str | None = "583231"):
        return self.create_external_user(
            user=self.actor,
            organization=self.organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@octocat",
            external_id=external_id,
            integration=self.create_integration(
                organization=self.organization, provider="github", external_id="gh:1"
            ),
        )

    def _for_user(self, user):
        return commit_author_for_user(user, self.organization.id, referrer="test")

    def _assert_outcome(self, mock_metrics: MagicMock, expected: str) -> None:
        mock_metrics.incr.assert_called_once_with(
            "autofix.commit_author.resolved", tags={"outcome": expected}
        )

    def test_github_actor_email_shape(self) -> None:
        assert commit_author_for_github_actor(login="octocat", external_id=583231) == {
            "name": "octocat",
            "email": OCTOCAT_EMAIL,
        }
        # A missing or non-numeric id degrades to the login-only noreply form, which
        # GitHub still attributes to the account -- it's the address GitHub itself
        # issues to pre-2017 accounts. So this is a supported author, not an error.
        assert commit_author_for_github_actor(login="octocat") == {
            "name": "octocat",
            "email": LOGIN_ONLY_EMAIL,
        }
        assert commit_author_for_github_actor(login="octocat", external_id="nope") == {
            "name": "octocat",
            "email": LOGIN_ONLY_EMAIL,
        }
        assert commit_author_for_github_actor(login="@octocat", external_id="1", name="Mona") == {
            "name": "Mona",
            "email": "1+octocat@users.noreply.github.com",
        }

    def test_user_resolves_via_external_actor(self) -> None:
        external_actor = self._link_github()
        assert self._for_user(self.actor) == {"name": "Mona Lisa", "email": OCTOCAT_EMAIL}

        external_actor.update(external_id=None)
        assert self._for_user(self.actor) == {"name": "Mona Lisa", "email": LOGIN_ONLY_EMAIL}

    @patch("sentry.seer.autofix.commit_author.get_github_username_for_user", return_value="octocat")
    def test_user_resolved_by_login_only_has_no_id(self, mock_lookup) -> None:
        # The CommitAuthor email fallback yields a login with no ExternalActor row.
        assert self._for_user(self.actor) == {"name": "Mona Lisa", "email": LOGIN_ONLY_EMAIL}

    def test_github_enterprise_only_user_has_no_author(self) -> None:
        # A GHE login has no github.com account, so the noreply form would misattribute.
        self.create_external_user(
            user=self.actor,
            organization=self.organization,
            provider=ExternalProviders.GITHUB_ENTERPRISE.value,
            external_name="@octocat",
            external_id="583231",
            integration=self.create_integration(
                organization=self.organization, provider="github_enterprise", external_id="ghe:1"
            ),
        )
        assert self._for_user(self.actor) is None

        # A github.com link alongside the enterprise one still resolves.
        self._link_github()
        assert self._for_user(self.actor) == {"name": "Mona Lisa", "email": OCTOCAT_EMAIL}

    def test_user_without_github_identity(self) -> None:
        assert self._for_user(self.actor) is None
        assert self._for_user(None) is None
        assert self._for_user(AnonymousUser()) is None

    @patch(
        "sentry.seer.autofix.commit_author.get_github_username_for_user",
        side_effect=Exception("boom"),
    )
    def test_user_lookup_exception(self, mock_lookup) -> None:
        assert self._for_user(self.actor) is None

    def test_feedback_single_github_commenter(self) -> None:
        assert commit_author_for_feedback(
            [comment_feedback("octocat", 583231)], self.organization.id
        ) == {"name": "octocat", "email": OCTOCAT_EMAIL}

        # Two comments from the same human, one of them a review body.
        review_body = Feedback(
            source=GithubPrReviewBodyFeedbackSource(
                review_id=5,
                review_state="commented",
                body="@sentry fix it",
                html_url="https://github.com/owner/repo/pull/1",
                user=GithubPrCommentUser(id=583231, login="Octocat"),
            )
        )
        assert commit_author_for_feedback(
            [comment_feedback("octocat", 583231), review_body], self.organization.id
        ) == {"name": "octocat", "email": OCTOCAT_EMAIL}

    def test_feedback_same_commenter_with_and_without_id(self) -> None:
        # One item carries the numeric id and the other doesn't; still one person.
        items = [
            comment_feedback("octocat", 583231),
            comment_feedback("octocat", None, comment_id=11),
        ]
        assert commit_author_for_feedback(items, self.organization.id) == {
            "name": "octocat",
            "email": OCTOCAT_EMAIL,
        }

    def test_feedback_from_github_and_ui_same_person(self) -> None:
        # Different identifier kinds never merge, so this degrades to no author.
        self._link_github()
        items = [
            comment_feedback("octocat", 583231),
            Feedback(source=UserUIFeedbackSource(user_id=self.actor.id, user_feedback="go")),
        ]
        assert commit_author_for_feedback(items, self.organization.id) is None

    def test_feedback_without_a_single_human_actor(self) -> None:
        octocat = comment_feedback("octocat", 1)
        hubot = comment_feedback("hubot", 2, comment_id=11)
        check_suite = check_suite_feedback()

        assert commit_author_for_feedback([], self.organization.id) is None
        assert commit_author_for_feedback([octocat, hubot], self.organization.id) is None
        assert commit_author_for_feedback([check_suite], self.organization.id) is None
        assert commit_author_for_feedback([octocat, check_suite], self.organization.id) is None
        assert commit_author_for_feedback([comment_feedback(None)], self.organization.id) is None

    def test_feedback_from_ui_resolves_sentry_user(self) -> None:
        items = [Feedback(source=UserUIFeedbackSource(user_id=self.actor.id, user_feedback="go"))]
        assert commit_author_for_feedback(items, self.organization.id) is None

        self._link_github()
        assert commit_author_for_feedback(items, self.organization.id) == {
            "name": "Mona Lisa",
            "email": OCTOCAT_EMAIL,
        }

    @patch(METRICS_PATH)
    def test_user_outcomes_are_distinctly_tagged(self, mock_metrics: MagicMock) -> None:
        # Each way of failing to resolve a user gets its own tag, so the metric
        # says *why* attribution was skipped rather than just that it was.
        self._for_user(None)
        self._assert_outcome(mock_metrics, "no_acting_user")

        mock_metrics.reset_mock()
        self._for_user(self.actor)
        self._assert_outcome(mock_metrics, "no_github_identity")

        mock_metrics.reset_mock()
        self.create_external_user(
            user=self.actor,
            organization=self.organization,
            provider=ExternalProviders.GITHUB_ENTERPRISE.value,
            external_name="@octocat",
            external_id="583231",
            integration=self.create_integration(
                organization=self.organization, provider="github_enterprise", external_id="ghe:2"
            ),
        )
        self._for_user(self.actor)
        self._assert_outcome(mock_metrics, "github_enterprise_only")

        mock_metrics.reset_mock()
        self._link_github()
        self._for_user(self.actor)
        self._assert_outcome(mock_metrics, "sentry_user")

    @patch(METRICS_PATH)
    def test_user_error_outcome_is_distinctly_tagged(self, mock_metrics: MagicMock) -> None:
        with patch(
            "sentry.seer.autofix.commit_author.get_github_username_for_user",
            side_effect=Exception("boom"),
        ):
            assert self._for_user(self.actor) is None
        self._assert_outcome(mock_metrics, "resolve_error")

    @patch(METRICS_PATH)
    def test_feedback_outcomes_are_distinctly_tagged(self, mock_metrics: MagicMock) -> None:
        commit_author_for_feedback([], self.organization.id)
        self._assert_outcome(mock_metrics, "no_feedback")

        mock_metrics.reset_mock()
        commit_author_for_feedback([check_suite_feedback()], self.organization.id)
        self._assert_outcome(mock_metrics, "automated_feedback")

        mock_metrics.reset_mock()
        commit_author_for_feedback(
            [comment_feedback("octocat", 1), comment_feedback("hubot", 2, comment_id=11)],
            self.organization.id,
        )
        self._assert_outcome(mock_metrics, "multiple_feedback_actors")

        mock_metrics.reset_mock()
        commit_author_for_feedback([comment_feedback(None)], self.organization.id)
        self._assert_outcome(mock_metrics, "unidentified_feedback_actor")

        mock_metrics.reset_mock()
        commit_author_for_feedback([comment_feedback("octocat", 583231)], self.organization.id)
        self._assert_outcome(mock_metrics, "github_actor")

    @patch(METRICS_PATH)
    def test_feedback_error_outcome_is_distinctly_tagged(self, mock_metrics: MagicMock) -> None:
        with patch(
            "sentry.seer.autofix.commit_author.user_service.get_user",
            side_effect=Exception("boom"),
        ):
            items = [
                Feedback(source=UserUIFeedbackSource(user_id=self.actor.id, user_feedback="go"))
            ]
            assert commit_author_for_feedback(items, self.organization.id) is None
        self._assert_outcome(mock_metrics, "feedback_error")

    def test_parse_commit_author(self) -> None:
        assert parse_commit_author('{"name": "Mona", "email": "mona@example.com"}') == {
            "name": "Mona",
            "email": "mona@example.com",
        }
        assert parse_commit_author(None) is None
        assert parse_commit_author("") is None
        assert parse_commit_author("not json") is None
        assert parse_commit_author('["a"]') is None
        assert parse_commit_author('{"name": "Mona"}') is None
