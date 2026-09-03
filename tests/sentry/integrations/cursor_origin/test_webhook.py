from __future__ import annotations

from typing import Any
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.webhook import CursorOriginWebhookEndpoint
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode

PROVIDER = IntegrationProviderSlug.CURSOR_ORIGIN.value


def _push_payload(installation_id: str | None, repo_id: str, sha: str = "a" * 40) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event": {
            "payload": {
                "repository": {"id": repo_id},
                "refUpdates": [
                    {"ref": "refs/heads/main", "headCommit": {"sha": sha}},
                ],
            }
        }
    }
    if installation_id is not None:
        payload["installationId"] = installation_id
    return payload


class PushInstallationScopingTest(TestCase):
    """A push delivery must only touch repositories of the installation that sent it.

    Repository is unique on (organization_id, provider, external_id), so the same
    external_id legitimately exists in several organizations. Matching on
    external_id alone wrote commits into all of them (Warden TKK-PFJ).
    """

    def setUp(self) -> None:
        super().setUp()
        self.endpoint = CursorOriginWebhookEndpoint()
        self.external_repo_id = "repo_shared"

        self.other_org = self.create_organization(name="other-org")
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization, provider=PROVIDER, external_id="in_mine"
            )
        self.mine = self.create_repo(
            project=self.project,
            name="mine/repo",
            provider=f"integrations:{PROVIDER}",
            integration_id=self.integration.id,
        )
        self.mine.update(external_id=self.external_repo_id, status=ObjectStatus.ACTIVE)

        other_project = self.create_project(organization=self.other_org)
        self.theirs = self.create_repo(
            project=other_project,
            name="theirs/repo",
            provider=f"integrations:{PROVIDER}",
        )
        self.theirs.update(external_id=self.external_repo_id, status=ObjectStatus.ACTIVE)

    def _run(self, payload: dict[str, Any]) -> None:
        # _record_ref_update fetches the commit range from Origin; the scoping
        # decision happens before that, so stub it and assert on which repos are
        # reached.
        with mock.patch.object(
            CursorOriginWebhookEndpoint, "_record_ref_update"
        ) as record_ref_update:
            self.endpoint._handle_push(payload)
        self.reached = [call.args[0].id for call in record_ref_update.call_args_list]

    def test_only_the_sending_installations_repository_is_touched(self) -> None:
        self._run(_push_payload("in_mine", self.external_repo_id))
        assert self.reached == [self.mine.id]
        assert self.theirs.id not in self.reached

    def test_unknown_installation_touches_nothing(self) -> None:
        self._run(_push_payload("in_nonexistent", self.external_repo_id))
        assert self.reached == []

    def test_missing_signed_installation_id_touches_nothing(self) -> None:
        # The id used to come from the unsigned webhook-installation-id header, so
        # a replayed delivery could aim at any organization. With no signed target
        # there is nothing safe to act on.
        self._run(_push_payload(None, self.external_repo_id))
        assert self.reached == []


class InstallationDeletedTest(TestCase):
    """Uninstall must be driven by signed material, not the header (Warden replay)."""

    def setUp(self) -> None:
        super().setUp()
        self.endpoint = CursorOriginWebhookEndpoint()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization, provider=PROVIDER, external_id="in_victim"
            )

    def test_disables_the_integration_named_in_the_body(self) -> None:
        self.endpoint._handle_installation_deleted({"installationId": "in_victim"})
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.refresh_from_db()
        assert self.integration.status == ObjectStatus.DISABLED

    def test_ignores_a_delivery_with_no_signed_installation_id(self) -> None:
        # A genuine delivery replayed with webhook-event-type rewritten to
        # installation.deleted must not disable anything.
        self.endpoint._handle_installation_deleted({"event": {"payload": {}}})
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.refresh_from_db()
        assert self.integration.status == ObjectStatus.ACTIVE


class CommitAuthorTypeTest(TestCase):
    """author_email arrives from untrusted JSON and is not necessarily a string.

    len() raises TypeError on an int, and CommitAuthorManager.get_or_create calls
    .lower(), which raises for a list or dict short enough to survive len()
    (Warden 4NP-B36).
    """

    def setUp(self) -> None:
        super().setUp()
        self.repo = self.create_repo(project=self.project, name="o/r")

    def _author(self, email: Any) -> CommitAuthor | None:
        return CursorOriginWebhookEndpoint._commit_author(
            self.repo, {"author_email": email, "author_name": "A"}, {}
        )

    def test_non_string_emails_are_ignored_rather_than_raising(self) -> None:
        for email in (123, ["a@example.com"], {"email": "a@example.com"}, 1.5, True):
            assert self._author(email) is None

    def test_a_real_email_still_resolves(self) -> None:
        author = self._author("a@example.com")
        assert author is not None
        assert author.email == "a@example.com"

    def test_an_over_long_email_is_ignored(self) -> None:
        assert self._author("x" * 76 + "@example.com") is None

    def test_a_non_string_name_is_not_stored(self) -> None:
        author = CursorOriginWebhookEndpoint._commit_author(
            self.repo, {"author_email": "b@example.com", "author_name": {"first": "A"}}, {}
        )
        assert author is not None
        assert author.name in (None, "")


class CommitCreationTest(TestCase):
    """Commits land against the repository's own organization."""

    def test_commit_is_created_for_the_repository_organization(self) -> None:
        repo = self.create_repo(project=self.project, name="o/r")
        endpoint = CursorOriginWebhookEndpoint()
        endpoint._create_commits(
            repo,
            [{"id": "b" * 40, "message": "fix things", "author_email": "c@example.com"}],
        )
        commit = Commit.objects.get(repository_id=repo.id, key="b" * 40)
        assert commit.organization_id == repo.organization_id
