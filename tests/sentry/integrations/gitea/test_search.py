from __future__ import annotations

import responses
from django.urls import reverse

from fixtures.gitea import BASE_URL, REPO_PATH, GiteaTestCase
from sentry.testutils.silo import control_silo_test

API_URL = f"{BASE_URL}/api/v1"


@control_silo_test
class GiteaIssueSearchTest(GiteaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.create_gitea_repo()
        self.url = reverse(
            "sentry-extensions-gitea-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": self.installation.model.id,
            },
        )

    @responses.activate
    def test_finds_issues(self) -> None:
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/issues",
            json=[
                {"number": 25, "title": "AEIOU Error"},
                {"number": 45, "title": "AEIOU Error again"},
            ],
        )

        response = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": REPO_PATH}
        )

        assert response.status_code == 200
        assert response.data == [
            {"value": 25, "label": "#25 AEIOU Error"},
            {"value": 45, "label": "#45 AEIOU Error again"},
        ]

    @responses.activate
    def test_issue_search_requires_a_repo(self) -> None:
        response = self.client.get(self.url, data={"field": "externalIssue", "query": "AEIOU"})

        assert response.status_code == 400
        assert response.data == {"detail": "repo is a required parameter"}

    @responses.activate
    def test_issue_search_in_a_repo_the_installation_does_not_have(self) -> None:
        response = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": "someone/else"}
        )

        # A 400 rather than an exception: `repo` is a raw query parameter, so an
        # unknown one is user error.
        assert response.status_code == 400
        assert "does not belong to this installation" in response.data["detail"]
        assert len(responses.calls) == 0

    @responses.activate
    def test_issue_search_with_a_climbing_repo_path(self) -> None:
        response = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": "../../user"}
        )

        assert response.status_code == 400
        assert len(responses.calls) == 0

    @responses.activate
    def test_issue_search_api_error(self) -> None:
        responses.add(
            responses.GET,
            f"{API_URL}/repos/{REPO_PATH}/issues",
            status=404,
            json={"message": "issues are disabled for this repository"},
        )

        response = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "repo": REPO_PATH}
        )

        assert response.status_code == 400
        assert "issues are disabled for this repository" in response.data["detail"]

    @responses.activate
    def test_finds_repositories(self) -> None:
        responses.add(
            responses.GET,
            f"{API_URL}/repos/search",
            json={
                "ok": True,
                "data": [
                    {
                        "id": 15,
                        "name": "widgets",
                        "full_name": REPO_PATH,
                        "html_url": f"{BASE_URL}/{REPO_PATH}",
                        "default_branch": "main",
                    }
                ],
            },
        )

        response = self.client.get(self.url, data={"field": "repo", "query": "widgets"})

        assert response.status_code == 200
        assert response.data == [{"value": REPO_PATH, "label": REPO_PATH}]

    def test_rejects_an_unknown_field(self) -> None:
        response = self.client.get(self.url, data={"field": "sentry", "query": "AEIOU"})

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid field"}

    def test_rejects_an_integration_from_another_organization(self) -> None:
        other_org = self.create_organization(owner=self.create_user())
        url = reverse(
            "sentry-extensions-gitea-search",
            kwargs={
                "organization_id_or_slug": other_org.slug,
                "integration_id": self.installation.model.id,
            },
        )

        response = self.client.get(url, data={"field": "repo", "query": "widgets"})

        assert response.status_code in (403, 404)
