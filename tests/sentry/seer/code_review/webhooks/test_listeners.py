from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
import pytest

from fixtures.github import PULL_REQUEST_OPENED_EVENT_EXAMPLE
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.repositorysettings import CodeReviewSettings, CodeReviewTrigger
from sentry.scm.types import PullRequestEvent
from sentry.seer.code_review.webhooks.listeners import pull_request_listener
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


def _make_pull_request_event(
    raw_event: dict[str, Any],
    *,
    action: str | None = None,
    draft: bool = False,
    head_sha: str | None = None,
) -> PullRequestEvent:
    if action is not None:
        raw_event = {**raw_event, "action": action}

    pr = raw_event["pull_request"]
    head_repo = pr["head"]["repo"]

    return PullRequestEvent(
        action=raw_event["action"],
        pull_request={
            "repository_id": str(head_repo["id"]),
            "id": str(pr["number"]),
            "title": pr["title"],
            "description": pr.get("body"),
            "head": {
                "ref": pr["head"]["ref"],
                "sha": head_sha if head_sha is not None else pr["head"]["sha"],
            },
            "base": {"ref": pr["base"]["ref"], "sha": pr["base"]["sha"]},
            "is_private_repo": head_repo["private"],
            "author": {"id": str(pr["user"]["id"]), "username": pr["user"]["login"]},
            "draft": draft,
        },
        subscription_event={
            "received_at": 1700000000,
            "type": "github",
            "event_type_hint": "pull_request",
            "event": orjson.dumps(raw_event).decode("utf-8"),
            "extra": {},
            "sentry_meta": None,
        },
    )


class TestPullRequestListener(TestCase):
    """Tests for the SCM event stream pull request listener."""

    GITHUB_EXTERNAL_ID = "12345"
    REPO_EXTERNAL_ID = "35129377"

    def setUp(self) -> None:
        super().setUp()
        self.raw_event = orjson.loads(PULL_REQUEST_OPENED_EVENT_EXAMPLE)

        future_expires = datetime.now().replace(microsecond=0) + timedelta(minutes=5)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.github_integration = self.create_integration(
                organization=self.organization,
                external_id=self.GITHUB_EXTERNAL_ID,
                provider="github",
                metadata={
                    "access_token": "ghu_token",
                    "expires_at": future_expires.isoformat(),
                },
            )
            self.github_integration.add_organization(self.organization.id, self.user)

        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=self.REPO_EXTERNAL_ID,
            integration_id=self.github_integration.id,
        )

    @pytest.fixture(autouse=True)
    def mock_preflight_allowed(self) -> Generator[None]:
        with patch(
            "sentry.seer.code_review.webhooks.listeners.CodeReviewPreflightService"
        ) as mock_cls:
            instance = mock_cls.return_value
            result = instance.check.return_value
            result.allowed = True
            result.denial_reason = None
            result.settings = CodeReviewSettings(
                enabled=True,
                triggers=[
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                    CodeReviewTrigger.ON_NEW_COMMIT,
                ],
            )
            self.mock_preflight_cls = mock_cls
            yield

    @pytest.fixture(autouse=True)
    def mock_schedule_task(self) -> Generator[None]:
        with patch("sentry.seer.code_review.webhooks.listeners.schedule_task") as mock_task:
            self.mock_schedule_task = mock_task
            yield

    @pytest.fixture(autouse=True)
    def mock_reactions(self) -> Generator[None]:
        with patch(
            "sentry.seer.code_review.webhooks.listeners.delete_existing_reactions_and_add_reaction"
        ) as mock_react:
            self.mock_reactions = mock_react
            yield

    # ---- Feature flag tests ----

    def test_skips_when_scm_listener_flag_is_off(self) -> None:
        event = _make_pull_request_event(self.raw_event)
        pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_processes_when_scm_listener_flag_is_on(self) -> None:
        event = _make_pull_request_event(self.raw_event)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()

    # ---- Action filtering tests ----

    def test_skips_unsupported_action(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="assigned")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_skips_unknown_action(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="future_action_not_in_enum")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    # ---- Draft PR tests ----

    def test_skips_draft_pr_for_opened(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="opened", draft=True)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_skips_draft_pr_for_synchronize(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="synchronize", draft=True)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_processes_closed_draft_pr(self) -> None:
        raw = {**self.raw_event, "action": "closed"}
        event = _make_pull_request_event(raw, draft=True)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()

    # ---- Integration/repo resolution tests ----

    def test_skips_when_no_installation_id(self) -> None:
        raw = {**self.raw_event}
        del raw["installation"]
        event = _make_pull_request_event(raw)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_skips_when_no_matching_integration(self) -> None:
        raw = {**self.raw_event, "installation": {"id": 99999}}
        event = _make_pull_request_event(raw)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    # ---- Preflight tests ----

    def test_skips_when_preflight_denies(self) -> None:
        self.mock_preflight_cls.return_value.check.return_value.allowed = False
        self.mock_preflight_cls.return_value.check.return_value.denial_reason = MagicMock(
            value="org_not_eligible"
        )
        event = _make_pull_request_event(self.raw_event)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    # ---- Trigger permission tests ----

    def test_skips_opened_when_trigger_disabled(self) -> None:
        self.mock_preflight_cls.return_value.check.return_value.settings = CodeReviewSettings(
            enabled=True,
            triggers=[CodeReviewTrigger.ON_NEW_COMMIT],
        )
        event = _make_pull_request_event(self.raw_event, action="opened")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_skips_synchronize_when_trigger_disabled(self) -> None:
        self.mock_preflight_cls.return_value.check.return_value.settings = CodeReviewSettings(
            enabled=True,
            triggers=[CodeReviewTrigger.ON_READY_FOR_REVIEW],
        )
        event = _make_pull_request_event(self.raw_event, action="synchronize")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_skips_closed_when_no_triggers_configured(self) -> None:
        self.mock_preflight_cls.return_value.check.return_value.settings = CodeReviewSettings(
            enabled=True,
            triggers=[],
        )
        raw = {**self.raw_event, "action": "closed"}
        event = _make_pull_request_event(raw)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    def test_processes_closed_when_triggers_configured(self) -> None:
        raw = {**self.raw_event, "action": "closed"}
        event = _make_pull_request_event(raw)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()

    # ---- Happy path tests ----

    def test_opened_schedules_task(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="opened")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()
        call_kwargs = self.mock_schedule_task.call_args[1]
        assert call_kwargs["github_event"] == GithubWebhookType.PULL_REQUEST
        assert call_kwargs["github_event_action"] == "opened"
        assert call_kwargs["target_commit_sha"] == self.raw_event["pull_request"]["head"]["sha"]

    def test_synchronize_schedules_task(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="synchronize")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()
        call_kwargs = self.mock_schedule_task.call_args[1]
        assert call_kwargs["github_event_action"] == "synchronize"

    def test_ready_for_review_schedules_task(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="ready_for_review")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_called_once()

    def test_skips_when_head_sha_is_missing(self) -> None:
        event = _make_pull_request_event(self.raw_event, head_sha="")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_schedule_task.assert_not_called()

    # ---- Reaction tests ----

    def test_adds_eyes_reaction_on_open(self) -> None:
        event = _make_pull_request_event(self.raw_event, action="opened")

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_reactions.assert_called_once()

    def test_no_reaction_on_close(self) -> None:
        raw = {**self.raw_event, "action": "closed"}
        event = _make_pull_request_event(raw)

        with self.feature("organizations:seer-code-review-scm-listener"):
            pull_request_listener(event)

        self.mock_reactions.assert_not_called()
