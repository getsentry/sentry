from functools import cached_property
from typing import Any

import orjson
import pytest
import responses

from sentry.integrations.gitea.repository import GiteaRepositoryProvider
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_commit_shape
from sentry.testutils.cases import IntegrationRepositoryTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.http import absolute_uri

GITEA_URL = "https://gitea.example.com"
API_URL = f"{GITEA_URL}/api/v1"
REPO_PATH = "acme/widgets"
REPO_ID = 42

REPO_JSON = {
    "id": REPO_ID,
    "full_name": REPO_PATH,
    "name": "widgets",
    "html_url": f"{GITEA_URL}/{REPO_PATH}",
    "default_branch": "main",
}


def gitea_commit(sha: str, files: list[dict[str, str]] | None = None) -> dict[str, Any]:
    commit: dict[str, Any] = {
        "sha": sha,
        "html_url": f"{GITEA_URL}/{REPO_PATH}/commit/{sha}",
        "commit": {
            "author": {
                "name": "Dev Eloper",
                "email": "dev@example.com",
                "date": "2026-08-01T10:00:00Z",
            },
            "message": f"Commit {sha}",
        },
    }
    if files is not None:
        commit["files"] = files
    return commit


class GiteaRepositoryProviderTest(IntegrationRepositoryTestCase):
    provider_name = "integrations:gitea"

    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider=IntegrationProviderSlug.GITEA.value,
                name="gitea.example.com",
                external_id="gitea.example.com:client-id",
                metadata={
                    "instance": "gitea.example.com",
                    "domain_name": "gitea.example.com",
                    "base_url": GITEA_URL,
                    "verify_ssl": True,
                    "webhook_secret": "hook-secret",
                    "scopes": ["read:repository", "read:user", "write:issue", "write:repository"],
                    "instance_version": "1.27.1",
                },
            )
            identity = self.create_identity(
                user=self.user,
                identity_provider=self.create_identity_provider(
                    type=IntegrationProviderSlug.GITEA.value
                ),
                external_id="gitea.example.com:7",
                data={
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    "expires": 1234567890,
                    "client_id": "client-id",
                    "client_secret": "client-secret",
                },
            )
            self.integration.add_organization(self.organization, self.user, identity.id)
            self.integration.get_provider().setup()

        # The base helper posts `identifier=repository_config["id"]`, and Gitea
        # keys every repository route on `owner/name` rather than a numeric id.
        self.default_repository_config = {"id": REPO_PATH}
        # Scoped to one (organization, integration) pair, so the hooks are
        # self-identifying and a sweep can never reach one another Sentry
        # organization registered on the same repository.
        self.webhook_url = absolute_uri(
            f"/extensions/gitea/organizations/{self.organization.id}/webhook/{self.integration.id}/"
        )

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    @cached_property
    def provider(self) -> GiteaRepositoryProvider:
        return GiteaRepositoryProvider("gitea")

    def add_create_repository_responses(self, repository_config: dict[str, Any]) -> None:
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}/hooks", json=[])
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", json={"id": 99})

    @assume_test_silo_mode(SiloMode.CELL)
    def get_repository(self, **kwargs: Any) -> Repository:
        return Repository.objects.get(**kwargs)

    @responses.activate
    def test_create_repository(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)

        assert response.status_code == 201
        repo = self.get_repository(
            organization_id=self.organization.id,
            provider=self.provider_name,
            external_id=f"gitea.example.com:{REPO_ID}",
        )
        assert repo.name == REPO_PATH
        assert repo.url == f"{GITEA_URL}/{REPO_PATH}"
        assert repo.integration_id == self.integration.id
        assert repo.config == {
            "instance": "gitea.example.com",
            "path": REPO_PATH,
            "webhook_id": 99,
        }

    @responses.activate
    def test_create_repository_registers_the_webhook(self) -> None:
        payloads = []

        def request_callback(request: Any) -> tuple[int, dict[str, str], str]:
            payloads.append(orjson.loads(request.body))
            return 201, {}, orjson.dumps({"id": 99}).decode()

        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}/hooks", json=[])
        responses.add_callback(
            responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", callback=request_callback
        )

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        assert response.status_code == 201
        assert payloads[0]["config"]["url"] == self.webhook_url
        # The composite token identifies the tenant and authenticates in one
        # step - both colons matter, so it is asserted whole.
        assert (
            payloads[0]["config"]["secret"]
            == f"{self.organization.id}:{self.integration.id}:hook-secret"
        )
        assert payloads[0]["events"] == ["push", "pull_request"]

    @responses.activate
    def test_create_repository_sweeps_a_stale_hook(self) -> None:
        # Replacing the OAuth app makes a new Integration row, leaving the old
        # row's hook behind with nothing on our side tracking it. Re-linking has
        # to converge on exactly one hook rather than doubling deliveries.
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[
                {"id": 11, "config": {"url": self.webhook_url}},
                {"id": 12, "config": {"url": "https://ci.example.com/hook"}},
            ],
        )
        responses.add(responses.DELETE, f"{API_URL}/repos/{REPO_PATH}/hooks/11", status=204)
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", json={"id": 99})

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        assert response.status_code == 201
        deleted = [call.request.url for call in responses.calls if call.request.method == "DELETE"]
        # Only ours: a hook belonging to someone else's CI stays put.
        assert deleted == [f"{API_URL}/repos/{REPO_PATH}/hooks/11"]

    @responses.activate
    def test_two_organizations_on_one_integration_keep_separate_hooks(self) -> None:
        """
        Two Sentry organizations that installed with the *same* OAuth app share
        one ``Integration`` row. If the hook URL named only the integration they
        would share it too, and the second organization to link a repository
        would sweep away the first's hook - after which whichever of them tore
        down first would silently kill the other's ingestion.
        """
        other_org = self.create_organization(owner=self.create_user())
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.add_organization(other_org)

        # Built through the production helper, not hand-written: if the URL
        # ever stops depending on the organization, this collapses onto our own
        # URL and the sweep below starts deleting the other org's hook.
        other_hook_url = GiteaRepositoryProvider.webhook_url(other_org.id, self.integration.id)
        assert other_hook_url != self.webhook_url

        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[{"id": 11, "config": {"url": other_hook_url}}],
        )
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", json={"id": 99})

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )
        assert response.status_code == 201

        deleted = [call.request.url for call in responses.calls if call.request.method == "DELETE"]
        assert deleted == []

    @responses.activate
    def test_create_repository_leaves_another_organizations_hook_alone(self) -> None:
        # Two Sentry organizations can link the same Gitea repository, and
        # Gitea's list-hooks response omits the secret. If our hooks all shared
        # one endpoint we could not tell theirs from ours, and sweeping would
        # silently kill their ingestion. That is not hypothetical: organizations
        # that install with the same OAuth app share an `Integration` row, so
        # only the organization in the URL keeps the sweeps apart.
        other_hook_url = absolute_uri(
            f"/extensions/gitea/organizations/{self.organization.id + 999}"
            f"/webhook/{self.integration.id}/"
        )
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[{"id": 11, "config": {"url": other_hook_url}}],
        )
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", json={"id": 99})

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        assert response.status_code == 201
        assert not [call for call in responses.calls if call.request.method == "DELETE"]

    @responses.activate
    def test_create_repository_webhook_failure_leaves_the_existing_hook_intact(self) -> None:
        # The repository row is persisted before this hook runs, so deleting
        # before creating would leave a repo that looks linked with no hook at
        # all - a working integration going dark after a failed no-op re-link.
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[{"id": 11, "config": {"url": self.webhook_url}}],
        )
        responses.add(
            responses.POST,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            status=422,
            json={"message": "Invalid url given"},
        )

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        assert response.status_code == 400
        self.assert_error_message(
            response, "validation", "Error Communicating with Gitea (HTTP 422): Invalid url given"
        )
        assert not [call for call in responses.calls if call.request.method == "DELETE"]

    @responses.activate
    def test_create_repository_rejects_an_identifier_that_is_not_owner_slash_name(self) -> None:
        # Straight off the request body, and Gitea takes it as real path
        # segments, so `requests` would resolve it onto an unrelated API route
        # with the installing user's token.
        for identifier in ("../../user", "acme", "acme/widgets/extra", "acme/../../user"):
            response = self.create_repository(
                {"id": identifier}, self.integration.id, add_responses=False
            )

            assert response.status_code == 400
            assert not responses.calls

    @responses.activate
    def test_create_repository_missing_repo_is_surfaced(self) -> None:
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", status=404)

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        # A repo the authorizing user cannot see reads as a bad choice of repo
        # rather than a missing Sentry resource.
        assert response.status_code == 400
        self.assert_error_message(response, "validation", "Error Communicating with Gitea")

    @assume_test_silo_mode(SiloMode.CELL)
    def _repository(self, **config: Any) -> Repository:
        repo = self.create_repo(
            project=self.create_project(organization=self.organization),
            name=REPO_PATH,
            provider=self.provider_name,
            integration_id=self.integration.id,
            url=f"{GITEA_URL}/{REPO_PATH}",
            external_id=f"gitea.example.com:{REPO_ID}",
        )
        repo.config = {"instance": "gitea.example.com", "path": REPO_PATH, **config}
        repo.save()
        return repo

    @responses.activate
    def test_on_delete_repository_removes_the_hook(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(responses.DELETE, f"{API_URL}/repos/{REPO_PATH}/hooks/99", status=204)

        self.provider.on_delete_repository(repo)

        assert responses.calls[0].request.url == f"{API_URL}/repos/{REPO_PATH}/hooks/99"

    @responses.activate
    def test_on_delete_repository_tolerates_an_already_deleted_hook(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(responses.DELETE, f"{API_URL}/repos/{REPO_PATH}/hooks/99", status=404)

        self.provider.on_delete_repository(repo)

    @responses.activate
    def test_on_delete_repository_without_a_hook_makes_no_call(self) -> None:
        self.provider.on_delete_repository(self._repository())

        assert not responses.calls

    @responses.activate
    def test_compare_commits(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/compare/aaa...bbb",
            json={
                "total_commits": 1,
                "commits": [
                    gitea_commit(
                        "bbb",
                        files=[
                            {"filename": "src/app.py", "status": "modified"},
                            {"filename": "src/new.py", "status": "added"},
                            {"filename": "src/gone.py", "status": "removed"},
                        ],
                    )
                ],
            },
        )

        commits = self.provider.compare_commits(repo, "aaa", "bbb")

        assert len(commits) == 1
        assert_commit_shape(commits[0])
        assert commits[0]["id"] == "bbb"
        assert commits[0]["author_email"] == "dev@example.com"
        assert commits[0]["patch_set"] == [
            {"path": "src/app.py", "type": "M"},
            {"path": "src/new.py", "type": "A"},
            {"path": "src/gone.py", "type": "D"},
        ]

    @responses.activate
    def test_compare_commits_without_a_start_sha_reads_the_commit_list(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/commits",
            json=[gitea_commit("bbb", files=[{"filename": "src/app.py", "status": "modified"}])],
        )

        commits = self.provider.compare_commits(repo, None, "bbb")

        assert [commit["id"] for commit in commits] == ["bbb"]
        assert "sha=bbb" in (responses.calls[0].request.url or "")

    @responses.activate
    def test_compare_commits_falls_back_to_the_single_commit_route_for_files(self) -> None:
        # An instance that did not compute stats hands back commits with no
        # `files`, and an empty patch set means suspect commits resolve nothing.
        repo = self._repository(webhook_id=99)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/compare/aaa...bbb",
            json={"commits": [gitea_commit("bbb")]},
        )
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/git/commits/bbb",
            json=gitea_commit("bbb", files=[{"filename": "src/app.py", "status": "modified"}]),
        )

        commits = self.provider.compare_commits(repo, "aaa", "bbb")

        assert commits[0]["patch_set"] == [{"path": "src/app.py", "type": "M"}]

    @responses.activate
    def test_compare_commits_unknown_file_status_reads_as_modified(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/compare/aaa...bbb",
            # Pre-1.22 instances omit `status` entirely.
            json={"commits": [gitea_commit("bbb", files=[{"filename": "src/app.py"}])]},
        )

        commits = self.provider.compare_commits(repo, "aaa", "bbb")

        assert commits[0]["patch_set"] == [{"path": "src/app.py", "type": "M"}]

    @responses.activate
    def test_compare_commits_error_is_wrapped(self) -> None:
        repo = self._repository(webhook_id=99)
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}/compare/aaa...bbb", status=500)

        with pytest.raises(Exception):
            self.provider.compare_commits(repo, "aaa", "bbb")

    def test_pull_request_url(self) -> None:
        repo = self._repository()
        pull_request = PullRequest(key="7")

        # Gitea's web route is `/pulls/`, not GitLab's `/merge_requests/`.
        assert (
            self.provider.pull_request_url(repo, pull_request) == f"{GITEA_URL}/{REPO_PATH}/pulls/7"
        )

    def test_repository_external_slug(self) -> None:
        assert self.provider.repository_external_slug(self._repository()) == REPO_PATH

    @responses.activate
    def test_create_repository_sweeps_a_stale_hook_beyond_the_first_page(self) -> None:
        # Gitea paginates `/hooks`, and a CI-heavy repo can carry more hooks
        # than one page holds. Ours hiding on page two would defeat the sweep.
        page_size = 50
        responses.add(responses.GET, f"{API_URL}/repos/{REPO_PATH}", json=REPO_JSON)
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[
                {"id": i, "config": {"url": f"https://ci.example.com/hook/{i}"}}
                for i in range(page_size)
            ],
        )
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/hooks",
            json=[{"id": 11, "config": {"url": self.webhook_url}}],
        )
        responses.add(responses.DELETE, f"{API_URL}/repos/{REPO_PATH}/hooks/11", status=204)
        responses.add(responses.POST, f"{API_URL}/repos/{REPO_PATH}/hooks", json={"id": 99})

        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )

        assert response.status_code == 201
        deleted = [call.request.url for call in responses.calls if call.request.method == "DELETE"]
        assert deleted == [f"{API_URL}/repos/{REPO_PATH}/hooks/11"]
