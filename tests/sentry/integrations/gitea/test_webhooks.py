from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest import mock
from unittest.mock import patch

import orjson

from fixtures.gitea import (
    BASE_URL,
    INSTANCE,
    REPO_PATH,
    WEBHOOK_SECRET,
    GiteaTestCase,
    gitea_signature,
    pull_request_event,
    push_event,
    webhook_token,
    webhook_url,
)
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode


class GiteaWebhookTest(GiteaTestCase):
    def post(
        self,
        body: bytes,
        event: str = "push",
        url: str | None = None,
        token: str | None = None,
        signature: str | None = None,
        omit_signature: bool = False,
    ) -> Any:
        headers: dict[str, Any] = {"HTTP_X_GITEA_EVENT": event}
        if not omit_signature:
            headers["HTTP_X_GITEA_SIGNATURE"] = (
                signature
                if signature is not None
                else gitea_signature(body, token or self.webhook_token)
            )
        return self.client.post(
            url or self.webhook_url, data=body, content_type="application/json", **headers
        )

    # Endpoint + verification

    def test_get_is_rejected(self) -> None:
        response = self.client.get(self.webhook_url)
        assert response.status_code == 405
        assert response.reason_phrase == "HTTP method not supported."

    def test_organization_and_integration_are_read_from_the_url(self) -> None:
        self.create_gitea_repo()
        response = self.post(push_event())

        assert response.status_code == 204
        assert Commit.objects.filter(organization_id=self.organization.id).count() == 2

    def test_non_numeric_ids_in_the_url(self) -> None:
        # A 400, not a 500 out of int().
        response = self.post(
            push_event(),
            url=f"/extensions/gitea/organizations/not-an-id/webhook/{self.integration.id}/",
        )

        assert response.status_code == 400
        assert response.reason_phrase == "The webhook URL is malformed."

    def test_unknown_integration(self) -> None:
        body = push_event()
        response = self.post(
            body,
            url=webhook_url(self.organization.id, self.integration.id + 999),
            token=webhook_token(self.organization.id, self.integration.id + 999),
        )

        assert response.status_code == 409
        assert response.reason_phrase == "There is no integration that matches your organization."

    def test_organization_that_never_installed_the_integration(self) -> None:
        # The organization and the integration both exist, but there is no
        # OrganizationIntegration joining them.
        other_org = self.create_organization(owner=self.create_user())
        response = self.post(
            push_event(),
            url=webhook_url(other_org.id, self.integration.id),
            token=webhook_token(other_org.id, self.integration.id),
        )

        assert response.status_code == 409
        assert response.reason_phrase == "There is no integration that matches your organization."

    def test_wrong_secret(self) -> None:
        body = push_event()
        response = self.post(
            body,
            token=webhook_token(self.organization.id, self.integration.id, "not-the-secret"),
        )

        assert response.status_code == 401
        assert "signature does not match" in response.reason_phrase

    def test_signature_minted_for_another_organization(self) -> None:
        """
        Two organizations that install with the same OAuth app share one
        ``Integration`` row and therefore one stored secret. Binding the
        organization into the HMAC key is what stops a body genuinely signed
        for one from being replayed verbatim at the other's endpoint.
        """
        other_org = self.create_organization(owner=self.create_user())
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(other_org)

        self.create_gitea_repo()
        body = push_event()
        response = self.post(
            body,
            signature=gitea_signature(body, webhook_token(other_org.id, self.integration.id)),
        )

        assert response.status_code == 401
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def test_absent_signature_header(self) -> None:
        # The signature is the only thing authenticating a delivery, so an
        # absent header has to fail closed rather than skip the check.
        self.create_gitea_repo()
        response = self.post(push_event(), omit_signature=True)

        assert response.status_code == 401
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def test_empty_signature_header(self) -> None:
        response = self.post(push_event(), signature="")
        assert response.status_code == 401
        assert "signature does not match" in response.reason_phrase

    def test_integration_without_a_webhook_secret(self) -> None:
        # Nothing can ever authenticate against this row, so answer terminally
        # rather than 5xx into a Gitea redelivery loop.
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(metadata={**self.integration.metadata, "webhook_secret": ""})

        response = self.post(push_event())

        assert response.status_code == 409
        assert "no webhook secret recorded" in response.reason_phrase

    def test_signature_over_a_tampered_body(self) -> None:
        self.create_gitea_repo()
        signature = gitea_signature(push_event(), self.webhook_token)
        # Same token, different body: the signature no longer covers it.
        tampered = push_event(
            commits=[
                {
                    "id": "e" * 40,
                    "message": "Injected",
                    "author": {"name": "Nobody", "email": "nobody@example.com"},
                    "timestamp": "2026-08-01T10:00:00+00:00",
                }
            ]
        )

        response = self.post(tampered, signature=signature)

        assert response.status_code == 401
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def test_invalid_json(self) -> None:
        body = b"{not json"
        response = self.post(body)
        assert response.status_code == 400
        assert response.reason_phrase == "Data received is not JSON."

    def test_non_object_json_payload(self) -> None:
        # Parses fine, then blows up on the first `.get` in a handler. That
        # would be a 500, which the cell delivery task retries, so it has to be
        # rejected terminally here.
        response = self.post(b'["not", "an", "object"]')

        assert response.status_code == 400
        assert response.reason_phrase == "Data received is not a JSON object."

    def test_unsupported_event_type_is_dropped_quietly(self) -> None:
        # Customers can widen the hook in Gitea's own UI. Ack rather than 400,
        # so Gitea does not retry an event we will never want.
        self.create_gitea_repo()
        response = self.post(push_event(), event="issues")

        assert response.status_code == 204
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def _stale_integration(self) -> Any:
        """
        The integration a replaced OAuth app leaves behind.

        Same host, same org, different client id - so it has its own
        ``external_id`` and its own endpoint, but an *identical*
        ``metadata["instance"]``, which is all a repository's external id is
        derived from. That collision is the whole point of the test.
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            stale = self.create_provider_integration(
                provider=self.provider,
                name=INSTANCE,
                external_id=f"{INSTANCE}:old-client-id",
                metadata={
                    "instance": INSTANCE,
                    "domain_name": INSTANCE,
                    "base_url": BASE_URL,
                    "verify_ssl": True,
                    "webhook_secret": WEBHOOK_SECRET,
                },
            )
            stale.add_organization(self.organization, self.user)
        return stale

    def test_delivery_from_a_stale_integration_is_dropped(self) -> None:
        """
        A delivery signed by a stale integration, for a repo now linked to a
        different one, must be dropped rather than misattributed.

        Replacing the OAuth app produces a new ``Integration`` row and leaves
        the old row's hooks behind on the Gitea side. Those hooks keep firing,
        genuinely signed, at an endpoint that still resolves to a real and still
        installed integration. Both integrations are on the same host, so both
        derive the same repository external id - the drop can only come from the
        repository lookup being scoped to the integration that owns it.
        """
        stale = self._stale_integration()

        # The repository is linked to the *current* integration.
        self.create_gitea_repo()

        body = push_event()
        response = self.post(
            body,
            url=webhook_url(self.organization.id, stale.id),
            token=webhook_token(self.organization.id, stale.id),
        )

        # Authenticated - the stale hook's signature is genuine - but nothing is
        # written, because the stale integration owns no repository row here.
        assert response.status_code == 204
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def test_another_orgs_repository_is_untouched(self) -> None:
        """
        Two orgs on one Gitea host, each with its own integration, both linking
        the same upstream repository. A delivery for one must not write to the
        other - their repository external ids are identical, since ``instance``
        is only the hostname.
        """
        other_org = self.create_organization(owner=self.create_user())
        other_project = self.create_project(organization=other_org)
        with assume_test_silo_mode(SiloMode.CONTROL):
            other_integration = self.create_provider_integration(
                provider=self.provider,
                name=INSTANCE,
                external_id=f"{INSTANCE}:other-client-id",
                metadata={
                    "instance": INSTANCE,
                    "domain_name": INSTANCE,
                    "base_url": BASE_URL,
                    "verify_ssl": True,
                    "webhook_secret": WEBHOOK_SECRET,
                },
            )
            other_integration.add_organization(other_org)

        other_repo = self.create_repo(
            project=other_project,
            name=REPO_PATH,
            provider="integrations:gitea",
            integration_id=other_integration.id,
            external_id=f"{INSTANCE}:15",
        )
        self.create_gitea_repo()

        assert self.post(push_event()).status_code == 204

        assert Commit.objects.filter(organization_id=self.organization.id).count() == 2
        assert not Commit.objects.filter(repository_id=other_repo.id).exists()
        assert not Commit.objects.filter(organization_id=other_org.id).exists()

    def test_unlinked_repository_is_ignored(self) -> None:
        response = self.post(push_event())

        assert response.status_code == 204
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    # Push handler

    def test_push_creates_commits(self) -> None:
        repo = self.create_gitea_repo()
        response = self.post(push_event())

        assert response.status_code == 204
        commits = Commit.objects.filter(organization_id=self.organization.id).order_by("key")
        assert [commit.key for commit in commits] == ["a" * 40, "b" * 40]

        first = commits[0]
        assert first.repository_id == repo.id
        assert first.message == "Fix the thing\n\nLonger body."
        assert first.date_added == datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)
        assert first.author is not None
        assert first.author.email == "dev@example.com"
        assert first.author.name == "Dev Eloper"
        assert first.author.organization_id == self.organization.id

    def test_push_is_idempotent(self) -> None:
        self.create_gitea_repo()
        assert self.post(push_event()).status_code == 204
        assert self.post(push_event()).status_code == 204

        assert Commit.objects.filter(organization_id=self.organization.id).count() == 2
        assert CommitAuthor.objects.filter(organization_id=self.organization.id).count() == 2

    def test_push_skips_ignored_commits(self) -> None:
        self.create_gitea_repo()
        body = push_event(
            commits=[
                {
                    "id": "a" * 40,
                    "message": "Merge branch 'main' into feature\n#skipsentry",
                    "author": {"name": "Dev Eloper", "email": "dev@example.com"},
                    "timestamp": "2026-08-01T10:00:00+00:00",
                }
            ]
        )
        response = self.post(body)

        assert response.status_code == 204
        assert not Commit.objects.filter(organization_id=self.organization.id).exists()

    def test_push_tolerates_a_missing_author_email(self) -> None:
        self.create_gitea_repo()
        body = push_event(
            commits=[
                {
                    "id": "a" * 40,
                    "message": "Fix the thing",
                    "author": {"name": "Dev Eloper", "email": ""},
                    "timestamp": "2026-08-01T10:00:00+00:00",
                }
            ]
        )
        response = self.post(body)

        assert response.status_code == 204
        commit = Commit.objects.get(organization_id=self.organization.id)
        assert commit.author is None

    def test_push_records_a_truncated_payload(self) -> None:
        # Gitea caps the commits array; nothing backfills the remainder today,
        # so the gap has to be visible rather than reading as a short push.
        self.create_gitea_repo()
        body = orjson.loads(push_event())
        body["total_commits"] = 250
        payload = orjson.dumps(body)

        with patch("sentry.integrations.gitea.webhooks.metrics.incr") as mock_incr:
            response = self.post(payload)

        assert response.status_code == 204
        assert Commit.objects.filter(organization_id=self.organization.id).count() == 2
        assert (
            mock.call("integrations.gitea.webhook.push.truncated", sample_rate=1.0)
            in mock_incr.call_args_list
        )

    def test_push_skips_a_malformed_commit(self) -> None:
        # One bad commit must not fail the request: Gitea would redeliver the
        # whole push and re-attempt every commit before it, forever.
        self.create_gitea_repo()
        body = orjson.loads(push_event())
        body["commits"][0].pop("timestamp")
        payload = orjson.dumps(body)

        response = self.post(payload)

        assert response.status_code == 204
        commits = Commit.objects.filter(organization_id=self.organization.id)
        assert [commit.key for commit in commits] == ["b" * 40]

    def test_push_updates_stale_repo_data(self) -> None:
        repo = self.create_gitea_repo(name="acme/old-name", url=f"{BASE_URL}/acme/old-name")

        response = self.post(push_event())

        assert response.status_code == 204
        repo.refresh_from_db()
        assert repo.url == f"{BASE_URL}/{REPO_PATH}"
        assert repo.config["path"] == REPO_PATH

    # Pull request handler

    def test_pull_request_opened(self) -> None:
        repo = self.create_gitea_repo()
        response = self.post(pull_request_event(), event="pull_request")

        assert response.status_code == 204
        pull = PullRequest.objects.get(organization_id=self.organization.id)
        assert pull.repository_id == repo.id
        assert pull.key == "4"
        assert pull.title == "Fix the thing"
        assert pull.message == "This fixes the thing."
        assert pull.state == PullRequestLifecycleState.OPEN
        assert pull.head_commit_sha == "c" * 40
        # Before a merge, `merge_commit_sha` names a test merge commit that is
        # on no branch, so it is deliberately not stored.
        assert pull.merge_commit_sha is None
        assert pull.draft is False
        assert pull.opened_at == datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)
        assert pull.closed_at is None
        assert pull.merged_at is None
        assert pull.author is not None
        assert pull.author.email == "dev@example.com"

    def test_pull_request_merged(self) -> None:
        self.create_gitea_repo()
        assert self.post(pull_request_event(), event="pull_request").status_code == 204

        body = pull_request_event(
            action="closed",
            state="closed",
            merged=True,
            merge_commit_sha="f" * 40,
            merged_at="2026-08-01T13:00:00Z",
            closed_at="2026-08-01T13:00:00Z",
            updated_at="2026-08-01T13:00:00Z",
        )
        assert self.post(body, event="pull_request").status_code == 204

        pull = PullRequest.objects.get(organization_id=self.organization.id)
        assert pull.state == PullRequestLifecycleState.MERGED
        assert pull.merge_commit_sha == "f" * 40
        assert pull.merged_at == datetime(2026, 8, 1, 13, 0, tzinfo=timezone.utc)
        assert pull.closed_at == datetime(2026, 8, 1, 13, 0, tzinfo=timezone.utc)

    def test_pull_request_stale_snapshot_is_dropped(self) -> None:
        self.create_gitea_repo()
        merged = pull_request_event(
            action="closed",
            state="closed",
            merged=True,
            merge_commit_sha="f" * 40,
            merged_at="2026-08-01T13:00:00Z",
            updated_at="2026-08-01T13:00:00Z",
        )
        assert self.post(merged, event="pull_request").status_code == 204

        # An out-of-order redelivery of the earlier "opened" snapshot.
        assert self.post(pull_request_event(), event="pull_request").status_code == 204

        pull = PullRequest.objects.get(organization_id=self.organization.id)
        assert pull.state == PullRequestLifecycleState.MERGED

    def test_pull_request_without_an_author_email(self) -> None:
        self.create_gitea_repo()
        body = pull_request_event(user={"id": 7, "login": "dev", "full_name": "Dev Eloper"})
        response = self.post(body, event="pull_request")

        assert response.status_code == 204
        pull = PullRequest.objects.get(organization_id=self.organization.id)
        assert pull.author is not None
        assert pull.author.email == "dev@localhost"
        assert pull.author.name == "Dev Eloper"

    def test_pull_request_missing_required_fields(self) -> None:
        self.create_gitea_repo()
        body = orjson.dumps(
            {
                "action": "opened",
                "pull_request": {"id": 900},
                "repository": orjson.loads(pull_request_event())["repository"],
            }
        )
        response = self.post(body, event="pull_request")

        assert response.status_code == 204
        assert not PullRequest.objects.filter(organization_id=self.organization.id).exists()
