from __future__ import absolute_import

import responses

from datetime import datetime, timedelta
from django.core.urlresolvers import reverse
from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import APITestCase


class GithubSearchTest(APITestCase):
    # There is another test case that inherits from this
    # one to ensure that github:enterprise behaves as expected.
    provider = "github"
    base_url = "https://api.github.com"

    def create_integration(self):
        future = datetime.now() + timedelta(hours=1)
        return Integration.objects.create(
            provider=self.provider,
            name="test",
            external_id=9999,
            metadata={
                "domain_name": "github.com/test",
                "account_type": "Organization",
                "access_token": "123456789",
                "expires_at": future.replace(microsecond=0).isoformat(),
            },
        )

    def setUp(self):
        super(GithubSearchTest, self).setUp()
        self.integration = self.create_integration()
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type=self.provider, config={}),
            user=self.user,
            external_id=self.user.id,
            data={"access_token": "123456789"},
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = self.integration.get_installation(self.organization.id)

        self.login_as(self.user)
        self.url = reverse(
            "sentry-extensions-github-search",
            kwargs={
                "organization_slug": self.organization.slug,
                "integration_id": self.installation.model.id,
            },
        )

    # Happy Paths
    @responses.activate
    def test_finds_external_issue_results(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20AEIOU",
            json={
                "items": [
                    {"number": 25, "title": "AEIOU Error"},
                    {"number": 45, "title": "AEIOU Error"},
                ]
            },
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == [
            {"value": 25, "label": "#25 AEIOU Error"},
            {"value": 45, "label": "#45 AEIOU Error"},
        ]

    @responses.activate
    def test_finds_external_issue_results_with_id(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%2025",
            json={"items": [{"number": 25, "title": "AEIOU Error"}]},
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "25", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == [{"value": 25, "label": "#25 AEIOU Error"}]

    @responses.activate
    def test_finds_repo_results(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20ex",
            json={
                "items": [
                    {"name": "example", "full_name": "test/example"},
                    {"name": "exhaust", "full_name": "test/exhaust"},
                ]
            },
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})

        assert resp.status_code == 200
        assert resp.data == [
            {"value": "test/example", "label": "example"},
            {"value": "test/exhaust", "label": "exhaust"},
        ]

    @responses.activate
    def test_repo_search_validation_error(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20nope",
            json={
                "message": "Validation Error",
                "errors": [{"message": "Cannot search for that org"}],
            },
            status=422,
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "nope", "repo": "example"})
        assert resp.status_code == 404
        assert "detail" in resp.data

    @responses.activate
    def test_finds_no_external_issues_results(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20nope",
            json={"items": []},
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "nope", "repo": "example"}
        )

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_finds_no_project_results(self):
        responses.add(
            responses.GET, self.base_url + "/search/repositories?q=org:test%20nope", json={}
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "nope"})

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_search_issues_rate_limit(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/issues?q=repo:example%20ex",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://developer.github.com/v3/#rate-limiting",
            },
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "ex", "repo": "example"}
        )
        assert resp.status_code == 429

    @responses.activate
    def test_search_project_rate_limit(self):
        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20ex",
            status=403,
            json={
                "message": "API rate limit exceeded",
                "documentation_url": "https://developer.github.com/v3/#rate-limiting",
            },
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})
        assert resp.status_code == 429

    # Request Validations
    def test_missing_field(self):
        resp = self.client.get(self.url, data={"query": "XYZ"})
        assert resp.status_code == 400

    def test_missing_query(self):
        resp = self.client.get(self.url, data={"field": "externalIssue"})

        assert resp.status_code == 400

    def test_invalid_field(self):
        resp = self.client.get(self.url, data={"field": "invalid-field", "query": "nope"})

        assert resp.status_code == 400

    # Missing Resources
    def test_missing_integration(self):
        url = reverse(
            "sentry-extensions-gitlab-search",
            kwargs={"organization_slug": self.organization.slug, "integration_id": "1234567890"},
        )
        resp = self.client.get(
            url, data={"field": "externalIssue", "query": "search", "repo": "example"}
        )

        assert resp.status_code == 404

    def test_missing_installation(self):
        # remove organization integration aka "uninstalling" installation
        self.installation.org_integration.delete()
        resp = self.client.get(self.url, data={"field": "repo", "query": "not-found"})

        assert resp.status_code == 404

    # Distributed System Issues
    @responses.activate
    def test_search_issues_request_fails(self):
        responses.add(
            responses.GET, self.base_url + "/search/issues?q=repo:example%20ex", status=503
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "ex", "repo": "example"}
        )
        assert resp.status_code == 503

    @responses.activate
    def test_projects_request_fails(self):
        responses.add(
            responses.GET, self.base_url + "/search/repositories?q=org:test%20ex", status=503
        )
        resp = self.client.get(self.url, data={"field": "repo", "query": "ex"})
        assert resp.status_code == 503
