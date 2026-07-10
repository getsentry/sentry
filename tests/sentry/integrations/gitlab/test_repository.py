import hashlib
from functools import cached_property
from unittest.mock import call, patch

import orjson
import pytest
import responses

from fixtures.gitlab import COMMIT_DIFF_RESPONSE, COMMIT_LIST_RESPONSE, COMPARE_RESPONSE
from sentry.integrations.gitlab.repository import GitlabRepositoryProvider
from sentry.integrations.services.repository.service import repository_service
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_commit_shape
from sentry.testutils.cases import IntegrationRepositoryTestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.identity import Identity


class GitLabRepositoryProviderTest(IntegrationRepositoryTestCase):
    provider_name = "integrations:gitlab"

    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider="gitlab",
                name="Example GitLab",
                external_id="example.gitlab.com:getsentry",
                metadata={
                    "instance": "example.gitlab.com",
                    "domain_name": "example.gitlab.com/getsentry",
                    "verify_ssl": False,
                    "base_url": "https://example.gitlab.com",
                    "webhook_secret": "secret-token-value",
                },
            )
            identity = Identity.objects.create(
                idp=self.create_identity_provider(
                    type="gitlab", config={}, external_id="1234567890"
                ),
                user=self.user,
                external_id="example.gitlab.com:4",
                data={"access_token": "1234567890"},
            )
            self.integration.add_organization(self.organization, self.user, identity.id)
            self.integration.get_provider().setup()

            self.default_repository_config = {
                "path_with_namespace": "getsentry/example-repo",
                "name_with_namespace": "Get Sentry / Example Repo",
                "path": "example-repo",
                "id": "123",
                "web_url": "https://example.gitlab.com/getsentry/projects/example-repo",
            }
            self.gitlab_id = 123

    @cached_property
    def provider(self):
        return GitlabRepositoryProvider("gitlab")

    def tearDown(self) -> None:
        super().tearDown()
        responses.reset()

    def add_create_repository_responses(self, repository_config):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % self.gitlab_id,
            json=repository_config,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/hooks" % self.gitlab_id,
            json={"id": 99},
        )

    @assume_test_silo_mode(SiloMode.CELL)
    def get_repository(self, **kwargs) -> Repository:
        return Repository.objects.get(**kwargs)

    def _rotate_webhook_secret(self, new_secret: str = "rotated-secret-value") -> None:
        """Simulate reinstalling against a new OAuth app: the derived webhook secret
        rotates, so the stored fingerprint no longer matches and the heal path runs."""
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.metadata["webhook_secret"] = new_secret
            self.integration.save()

    def assert_repository(self, repository_config, organization_id=None):
        instance = self.integration.metadata["instance"]

        external_id = "{}:{}".format(instance, repository_config["id"])
        repo = self.get_repository(
            organization_id=organization_id or self.organization.id,
            provider=self.provider_name,
            external_id=external_id,
        )
        expected_fingerprint = hashlib.sha256(
            "{}:{}".format(
                self.integration.external_id, self.integration.metadata["webhook_secret"]
            ).encode()
        ).hexdigest()
        assert repo.name == repository_config["name_with_namespace"]
        assert repo.url == repository_config["web_url"]
        assert repo.integration_id == self.integration.id
        assert repo.config == {
            "instance": instance,
            "path": repository_config["path_with_namespace"],
            "project_id": repository_config["id"],
            "webhook_id": 99,
            "webhook_fingerprint": expected_fingerprint,
        }

    @responses.activate
    def test_create_repository(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        assert response.status_code == 201
        self.assert_repository(self.default_repository_config)

    @responses.activate
    def test_on_create_repository_refreshes_existing_webhook(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        repo = repository_service.get_repository(
            organization_id=self.organization.id, id=response.data["id"]
        )
        assert repo is not None
        webhook_id = repo.config["webhook_id"]

        # Rotate the secret so the stored fingerprint no longer matches; otherwise
        # the unchanged-secret skip would short-circuit before any GitLab call.
        self._rotate_webhook_secret()

        # The stored hook still exists, so we address it by id and update it in
        # place (refreshing its token + events) rather than recreating it. Assert
        # the refreshed token carries the integration's current secret — this is
        # what heals a rotated secret after reinstalling against a new OAuth app.
        def request_callback(request):
            payload = orjson.loads(request.body)
            expected_token = "{}:{}".format(
                self.integration.external_id, self.integration.metadata["webhook_secret"]
            )
            assert payload["token"] == expected_token
            assert payload["merge_requests_events"]
            assert payload["push_events"]
            return 200, {}, orjson.dumps({"id": webhook_id}).decode()

        responses.add_callback(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/%s/hooks/%s" % (self.gitlab_id, webhook_id),
            callback=request_callback,
        )

        with patch("sentry.integrations.gitlab.repository.logger.info") as mock_logger_info:
            self.provider.on_create_repository(repo, self.organization)

        # Addressed by id: a single PUT, no listing.
        assert [c.request.method for c in responses.calls] == ["PUT"]
        # webhook_id is left untouched when we refresh an existing hook, and the
        # fingerprint is updated so the next reactivation skips the GitLab call.
        refreshed = self.get_repository(pk=response.data["id"])
        assert refreshed.config["webhook_id"] == webhook_id
        assert refreshed.config.get("webhook_fingerprint")
        mock_logger_info.assert_has_calls(
            [
                call(
                    "gitlab.repository.on_create_repository",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.has_existing_webhook": True,
                    },
                ),
                call(
                    "gitlab.repository.webhook_refreshed",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.webhook_id": webhook_id,
                    },
                ),
            ]
        )

    @responses.activate
    def test_on_create_repository_recreates_stale_webhook(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        repo = repository_service.get_repository(
            organization_id=self.organization.id, id=response.data["id"]
        )
        assert repo is not None
        stale_webhook_id = repo.config["webhook_id"]

        # Rotate the secret so we get past the unchanged-secret skip and actually
        # address the (now-missing) hook.
        self._rotate_webhook_secret()

        # Updating the stored hook by id 404s (it no longer exists on GitLab), so a
        # fresh hook is created and its new id stored.
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/%s/hooks/%s"
            % (self.gitlab_id, stale_webhook_id),
            status=404,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/hooks" % self.gitlab_id,
            json={"id": 200},
        )

        with patch("sentry.integrations.gitlab.repository.logger.info") as mock_logger_info:
            self.provider.on_create_repository(repo, self.organization)

        assert [c.request.method for c in responses.calls] == ["PUT", "POST"]
        recreated = self.get_repository(pk=response.data["id"])
        assert recreated.config["webhook_id"] == 200
        assert recreated.config.get("webhook_fingerprint")
        mock_logger_info.assert_has_calls(
            [
                call(
                    "gitlab.repository.on_create_repository",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.has_existing_webhook": True,
                    },
                ),
                call(
                    "gitlab.repository.webhook_stale_recreated",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.webhook_id": 200,
                    },
                ),
            ]
        )

    @responses.activate
    def test_on_create_repository_update_webhook_non_404_failure(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        repo = repository_service.get_repository(
            organization_id=self.organization.id, id=response.data["id"]
        )
        assert repo is not None
        webhook_id = repo.config["webhook_id"]

        # Rotate the secret so we get past the unchanged-secret skip and attempt the PUT.
        self._rotate_webhook_secret()

        # A non-404 error while updating the hook surfaces as an error and does NOT
        # fall through to create a duplicate hook.
        responses.add(
            responses.PUT,
            "https://example.gitlab.com/api/v4/projects/%s/hooks/%s" % (self.gitlab_id, webhook_id),
            status=503,
        )

        with pytest.raises(IntegrationError):
            self.provider.on_create_repository(repo, self.organization)

        # No POST: a non-404 failure must not fall through and create a duplicate hook.
        methods = [c.request.method for c in responses.calls]
        assert "POST" not in methods
        assert set(methods) == {"PUT"}
        unchanged = self.get_repository(pk=response.data["id"])
        assert unchanged.config["webhook_id"] == webhook_id

    @responses.activate
    def test_on_create_repository_skips_when_secret_unchanged(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        repo = repository_service.get_repository(
            organization_id=self.organization.id, id=response.data["id"]
        )
        assert repo is not None
        webhook_id = repo.config["webhook_id"]
        # Creating the repo stored a fingerprint for the current secret. Nothing has
        # rotated, so a subsequent invocation must make zero GitLab calls.
        assert repo.config.get("webhook_fingerprint")

        with patch("sentry.integrations.gitlab.repository.logger.info") as mock_logger_info:
            self.provider.on_create_repository(repo, self.organization)

        assert len(responses.calls) == 0
        mock_logger_info.assert_has_calls(
            [
                call(
                    "gitlab.repository.on_create_repository",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.has_existing_webhook": True,
                    },
                ),
                call(
                    "gitlab.repository.webhook_unchanged",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.webhook_id": webhook_id,
                    },
                ),
            ]
        )

    @responses.activate
    def test_on_create_repository_logs_webhook_creation(self) -> None:
        self.add_create_repository_responses(self.default_repository_config)

        with patch("sentry.integrations.gitlab.repository.logger.info") as mock_logger_info:
            response = self.create_repository(self.default_repository_config, self.integration.id)

        assert response.status_code == 201
        repo = self.get_repository(pk=response.data["id"])

        mock_logger_info.assert_has_calls(
            [
                call(
                    "gitlab.repository.on_create_repository",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.has_existing_webhook": False,
                    },
                ),
                call(
                    "gitlab.repository.webhook_created",
                    extra={
                        "gitlab.repository.organization_id": self.organization.id,
                        "gitlab.repository.integration_id": self.integration.id,
                        "gitlab.repository.repository_id": repo.id,
                        "gitlab.repository.project_id": repo.config["project_id"],
                        "gitlab.repository.webhook_id": repo.config["webhook_id"],
                    },
                ),
            ]
        )

    @responses.activate
    def test_create_repository_verify_payload(self) -> None:
        def request_callback(request):
            payload = orjson.loads(request.body)
            assert "url" in payload
            assert payload["push_events"]
            assert payload["merge_requests_events"]
            expected_token = "{}:{}".format(
                self.integration.external_id, self.integration.metadata["webhook_secret"]
            )
            assert payload["token"] == expected_token

            return 201, {}, orjson.dumps({"id": 99}).decode()

        responses.add_callback(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/hooks" % self.gitlab_id,
            callback=request_callback,
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        assert response.status_code == 201
        self.assert_repository(self.default_repository_config)

    @responses.activate
    def test_create_repository_request_invalid_url(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % self.gitlab_id,
            status=200,
            json=self.default_repository_config,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/hooks" % self.gitlab_id,
            status=422,
            json={"error": "Invalid url given"},
        )
        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )
        assert response.status_code == 400
        self.assert_error_message(
            response, "validation", "Error Communicating with GitLab (HTTP 422): Invalid url given"
        )

    def test_create_repository_data_no_installation_id(self) -> None:
        response = self.create_repository(self.default_repository_config, None)
        assert response.status_code == 400
        self.assert_error_message(response, "validation", "requires an integration id")

    def test_create_repository_data_integration_does_not_exist(self) -> None:
        integration_id = self.integration.id
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        response = self.create_repository(self.default_repository_config, integration_id)
        assert response.status_code == 404
        self.assert_error_message(
            response, "not found", "Integration matching query does not exist."
        )

    def test_create_repository_org_given_has_no_installation(self) -> None:
        organization = self.create_organization(owner=self.user)
        response = self.create_repository(
            self.default_repository_config, self.integration.id, organization.slug
        )
        assert response.status_code == 404

    @responses.activate
    def test_create_repository_get_project_request_fails(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % self.gitlab_id,
            status=503,
        )
        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )
        assert response.status_code == 503

    @responses.activate
    def test_create_repository_integration_create_webhook_failure(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s" % self.gitlab_id,
            json=self.default_repository_config,
        )
        responses.add(
            responses.POST,
            "https://example.gitlab.com/api/v4/projects/%s/hooks" % self.gitlab_id,
            status=503,
        )
        response = self.create_repository(
            self.default_repository_config, self.integration.id, add_responses=False
        )
        assert response.status_code == 503

    @responses.activate
    def test_on_delete_repository_remove_webhook(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        responses.add(
            responses.DELETE,
            "https://example.gitlab.com/api/v4/projects/%s/hooks/99" % self.gitlab_id,
            status=204,
        )
        repo = self.get_repository(pk=response.data["id"])
        self.provider.on_delete_repository(repo)
        assert len(responses.calls) == 1

    @responses.activate
    def test_on_delete_repository_remove_webhook_missing_hook(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        responses.reset()

        responses.add(
            responses.DELETE,
            "https://example.gitlab.com/api/v4/projects/%s/hooks/99" % self.gitlab_id,
            status=404,
        )
        repo = self.get_repository(pk=response.data["id"])
        self.provider.on_delete_repository(repo)
        assert len(responses.calls) == 1

    @responses.activate
    def test_compare_commits_start_and_end(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/compare?from=abc&to=xyz"
            % self.gitlab_id,
            json=orjson.loads(COMPARE_RESPONSE),
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/12d65c8dd2b2676fa3ac47d955accc085a37a9c1/diff"
            % self.gitlab_id,
            json=orjson.loads(COMMIT_DIFF_RESPONSE),
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/8b090c1b79a14f2bd9e8a738f717824ff53aebad/diff"
            % self.gitlab_id,
            json=orjson.loads(COMMIT_DIFF_RESPONSE),
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        commits = self.provider.compare_commits(repo, "abc", "xyz")
        assert 2 == len(commits)
        for commit in commits:
            assert_commit_shape(commit)

    @responses.activate
    def test_compare_commits_start_and_end_gitlab_failure(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/compare?from=abc&to=xyz"
            % self.gitlab_id,
            status=502,
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(repo, "abc", "xyz")

    @responses.activate
    def test_compare_commits_no_start(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/xyz" % self.gitlab_id,
            json={"created_at": "2018-09-19T13:14:15Z"},
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits?until=2018-09-19T13:14:15Z"
            % self.gitlab_id,
            json=orjson.loads(COMMIT_LIST_RESPONSE),
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/ed899a2f4b50b4370feeea94676502b42383c746/diff"
            % self.gitlab_id,
            json=orjson.loads(COMMIT_DIFF_RESPONSE),
        )
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/6104942438c14ec7bd21c6cd5bd995272b3faff6/diff"
            % self.gitlab_id,
            json=orjson.loads(COMMIT_DIFF_RESPONSE),
        )

        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        commits = self.provider.compare_commits(repo, None, "xyz")
        for commit in commits:
            assert_commit_shape(commit)

    @responses.activate
    def test_compare_commits_no_start_gitlab_failure(self) -> None:
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/%s/repository/commits/abc" % self.gitlab_id,
            status=502,
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(repo, None, "abc")

    @responses.activate
    def test_pull_request_url(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        pull = PullRequest(key=99)
        result = self.provider.pull_request_url(repo, pull)
        assert (
            result == "https://example.gitlab.com/getsentry/projects/example-repo/merge_requests/99"
        )

    @responses.activate
    def test_repository_external_slug(self) -> None:
        response = self.create_repository(self.default_repository_config, self.integration.id)
        repo = self.get_repository(pk=response.data["id"])
        result = self.provider.repository_external_slug(repo)
        assert result == repo.config["project_id"]
