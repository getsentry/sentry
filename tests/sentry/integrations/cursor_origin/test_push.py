from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_API_BASE_URL
from sentry.integrations.cursor_origin.push import RepositoryPushedHandler
from sentry.integrations.cursor_origin.webhook_types import (
    OriginPayloadError,
    PushedCommit,
    PushEvent,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test

INSTALLATION_ID = "i_01example"
REPO = "acme/rocket"
REPO_EXTERNAL_ID = "r_01example"
EMPTY_SHA = "0" * 40


def _head_commit(sha: str, message: str = "a change") -> dict[str, Any]:
    return {
        "sha": sha,
        "author": {"name": "A Dev", "email": "dev@example.com", "date": "2026-09-16T12:00:00Z"},
        "committer": {"name": "A Dev", "email": "dev@example.com", "date": "2026-09-16T12:00:00Z"},
        "message": message,
    }


def _listed_commit(sha: str, message: str = "a change") -> dict[str, Any]:
    return {
        "sha": sha,
        "commit": {
            "author": {"name": "A Dev", "email": "dev@example.com", "date": "2026-09-16T12:00:00Z"},
            "committer": {
                "name": "A Dev",
                "email": "dev@example.com",
                "date": "2026-09-16T12:00:00Z",
            },
            "message": message,
        },
        "parents": [],
    }


def _file(filename: str, status: str) -> dict[str, Any]:
    return {
        "filename": filename,
        "status": status,
        "additions": 1,
        "deletions": 0,
        "changes": 1,
        "patch": "",
    }


def _payload(*ref_updates: dict[str, Any], external_id: str = REPO_EXTERNAL_ID) -> dict[str, Any]:
    return {
        "repository": {"id": external_id, "name": "rocket"},
        "refUpdates": list(ref_updates),
        "pushedAt": "2026-09-16T12:00:05Z",
    }


def _ref_update(**overrides: Any) -> dict[str, Any]:
    update: dict[str, Any] = {
        "ref": "refs/heads/main",
        "before": "aaa",
        "after": "bbb",
        "created": False,
        "deleted": False,
        "forced": False,
    }
    update.update(overrides)
    return update


@cell_silo_test
class RepositoryPushedHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
            metadata={
                "access_token": "oit_stored",
                "expires_at": (datetime.now(UTC) + timedelta(minutes=14))
                .isoformat()
                .replace("+00:00", "Z"),
            },
            status=ObjectStatus.ACTIVE,
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=REPO,
            provider="integrations:cursor_origin",
            integration_id=self.integration.id,
            external_id=REPO_EXTERNAL_ID,
            config={"name": REPO, "default_branch": "main"},
        )
        context = integration_service.organization_contexts(
            provider="cursor_origin", external_id=INSTALLATION_ID
        )
        assert context.integration is not None
        self.rpc_integration = context.integration
        self.org_integrations = context.organization_integrations

    def _handle(self, payload: dict[str, Any]) -> None:
        RepositoryPushedHandler()(
            payload, "whd_01example", self.rpc_integration, self.org_integrations
        )

    def _stub_compare(
        self, ahead_by: int, status_name: str = "ahead", before: str = "aaa", after: str = "bbb"
    ) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/compare/{before}...{after}",
            json={"status": status_name, "aheadBy": ahead_by, "behindBy": 0},
        )

    def _stub_commits(self, *commits: dict[str, Any]) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits",
            json={"commits": list(commits), "nextPageToken": ""},
        )

    def _stub_files(self, sha: str, *files: dict[str, Any]) -> None:
        responses.add(
            responses.GET,
            f"{CURSOR_ORIGIN_API_BASE_URL}/repos/{REPO}/commits/{sha}/files",
            json={"files": list(files), "nextPageToken": ""},
        )

    def _paths(self) -> list[str]:
        return [call.request.url.split("?")[0] for call in responses.calls]

    def _commits(self) -> list[Commit]:
        return list(Commit.objects.filter(repository_id=self.repo.id).order_by("date_added"))

    @responses.activate
    def test_a_pushed_commit_is_recorded(self) -> None:
        self._stub_compare(ahead_by=1)
        self._stub_files("bbb", _file("src/app.py", "modified"))

        self._handle(_payload(_ref_update(headCommit=_head_commit("bbb", "fix: a thing"))))

        commit = self._commits()[0]
        assert commit.key == "bbb"
        assert commit.message == "fix: a thing"
        assert commit.author is not None
        assert commit.author.email == "dev@example.com"
        changes = CommitFileChange.objects.filter(commit_id=commit.id)
        assert [(c.filename, c.type) for c in changes] == [("src/app.py", "M")]

    @responses.activate
    def test_the_payload_tip_saves_a_call_for_a_single_commit(self) -> None:
        """Origin carries best-effort tip metadata, which covers the usual push."""
        self._stub_compare(ahead_by=1)
        self._stub_files("bbb")

        self._handle(_payload(_ref_update(headCommit=_head_commit("bbb"))))

        assert [c.key for c in self._commits()] == ["bbb"]
        assert not [path for path in self._paths() if path.endswith("/commits")]

    @responses.activate
    def test_several_commits_are_read_back_oldest_first(self) -> None:
        self._stub_compare(ahead_by=2, after="ccc")
        self._stub_commits(_listed_commit("ccc"), _listed_commit("bbb"))
        self._stub_files("ccc")
        self._stub_files("bbb")

        self._handle(_payload(_ref_update(after="ccc", headCommit=_head_commit("ccc"))))

        assert [c.key for c in self._commits()] == ["bbb", "ccc"]

    @responses.activate
    def test_a_deleted_branch_records_nothing(self) -> None:
        self._handle(_payload(_ref_update(deleted=True, after=EMPTY_SHA)))

        assert self._commits() == []
        assert len(responses.calls) == 0

    @responses.activate
    def test_a_tag_is_ignored(self) -> None:
        self._handle(_payload(_ref_update(ref="refs/tags/v1.0.0")))

        assert self._commits() == []
        assert len(responses.calls) == 0

    @responses.activate
    def test_a_new_branch_records_only_its_tip(self) -> None:
        """Its whole history is new against an empty tip, and none of it is a release."""
        self._stub_files("bbb")

        self._handle(
            _payload(_ref_update(created=True, before=EMPTY_SHA, headCommit=_head_commit("bbb")))
        )

        assert [c.key for c in self._commits()] == ["bbb"]
        assert not [path for path in self._paths() if "/compare/" in path]

    @responses.activate
    def test_a_ref_that_gained_nothing_records_nothing(self) -> None:
        self._stub_compare(ahead_by=0, status_name="identical")

        self._handle(_payload(_ref_update()))

        assert self._commits() == []

    @responses.activate
    def test_a_redelivery_does_not_duplicate_a_commit(self) -> None:
        self._stub_compare(ahead_by=1)
        self._stub_files("bbb")
        payload = _payload(_ref_update(headCommit=_head_commit("bbb")))

        self._handle(payload)
        self._handle(payload)

        assert [c.key for c in self._commits()] == ["bbb"]
        # The second delivery stops at the existence check, before reading files again.
        assert len([path for path in self._paths() if path.endswith("/files")]) == 1

    @responses.activate
    def test_a_skipped_commit_is_left_out(self) -> None:
        """Sentry honours #skipsentry in a commit message."""
        self._stub_compare(ahead_by=1)

        self._handle(_payload(_ref_update(headCommit=_head_commit("bbb", "wip #skipsentry"))))

        assert self._commits() == []

    @responses.activate
    def test_an_unknown_repository_is_ignored(self) -> None:
        self._handle(_payload(_ref_update(), external_id="r_01nope"))

        assert self._commits() == []
        assert len(responses.calls) == 0

    @responses.activate
    def test_an_author_is_reused_across_commits(self) -> None:
        self._stub_compare(ahead_by=2, after="ccc")
        self._stub_commits(_listed_commit("ccc"), _listed_commit("bbb"))
        self._stub_files("ccc")
        self._stub_files("bbb")

        self._handle(_payload(_ref_update(after="ccc", headCommit=_head_commit("ccc"))))

        authors = CommitAuthor.objects.filter(organization_id=self.organization.id)
        assert len(authors) == 1
        assert authors[0].email == "dev@example.com"


class PushEventTest(TestCase):
    def test_a_payload_keeps_only_what_the_handler_reads(self) -> None:
        """Origin asks receivers to ignore unknown fields, so extras must survive."""
        payload = _payload(_ref_update())
        payload["pushedBy"] = {"slug": "a-dev"}
        payload["repository"]["name"] = "rocket"

        push = PushEvent.from_payload(payload)

        assert push.repository_id == REPO_EXTERNAL_ID
        assert push.ref_updates[0].ref == "refs/heads/main"

    def test_no_ref_updates_is_valid(self) -> None:
        assert PushEvent.from_payload(_payload()).ref_updates == []

    def test_a_missing_repository_id_is_refused(self) -> None:
        payload = _payload(_ref_update())
        del payload["repository"]["id"]

        with pytest.raises(OriginPayloadError, match="repository.id"):
            PushEvent.from_payload(payload)

    def test_a_ref_update_with_no_ref_is_refused(self) -> None:
        payload = _payload(_ref_update())
        del payload["refUpdates"][0]["ref"]

        with pytest.raises(OriginPayloadError, match=r"refUpdates\[0\].ref"):
            PushEvent.from_payload(payload)

    def test_ref_updates_of_the_wrong_type_is_refused(self) -> None:
        payload = _payload()
        payload["refUpdates"] = "refs/heads/main"

        with pytest.raises(OriginPayloadError, match="refUpdates must be an array"):
            PushEvent.from_payload(payload)


class PushedCommitTest(TestCase):
    def test_a_head_commit_and_an_api_commit_become_the_same_thing(self) -> None:
        """The payload carries its tip flat; the API nests the detail under `commit`."""
        from_payload = PushedCommit.from_head_commit(_head_commit("bbb", "fix: a thing"))
        from_api = PushedCommit.from_api_commit(_listed_commit("bbb", "fix: a thing"))

        assert from_payload == from_api

    def test_a_head_commit_with_no_sha_is_unusable(self) -> None:
        """Origin documents `headCommit` as best-effort, so partial is not an error."""
        assert PushedCommit.from_head_commit({"message": "a change"}) is None
