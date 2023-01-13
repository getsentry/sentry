from urllib.parse import parse_qs

import responses
from django.urls import reverse

from fixtures.gitlab import GitLabTestCase
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.utils import json


class GitlabSearchTest(GitLabTestCase):
    provider = "gitlab"

    def setUp(self):
        super().setUp()
        self.url = reverse(
            "sentry-extensions-gitlab-search",
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
            "https://example.gitlab.com/api/v4/projects/5/issues?scope=all&search=AEIOU",
            json=[
                {"iid": 25, "title": "AEIOU Error", "project_id": "5"},
                {"iid": 45, "title": "AEIOU Error", "project_id": "5"},
            ],
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "AEIOU", "project": "5"}
        )

        assert resp.status_code == 200
        assert resp.data == [
            {"value": "5#25", "label": "(#25) AEIOU Error"},
            {"value": "5#45", "label": "(#45) AEIOU Error"},
        ]

    @responses.activate
    def test_finds_external_issue_results_with_iid(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/5/issues?scope=all&iids=25",
            json=[{"iid": 25, "title": "AEIOU Error", "project_id": "5"}],
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "25", "project": "5"}
        )

        assert resp.status_code == 200
        assert resp.data == [{"value": "5#25", "label": "(#25) AEIOU Error"}]

    @responses.activate
    def test_finds_project_results(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/1/projects?search=GetSentry&simple=True&include_subgroups=False&page=1&per_page=100&order_by=last_activity_at",
            json=[
                {
                    "id": "1",
                    "name_with_namespace": "GetSentry / Sentry",
                    "path_with_namespace": "getsentry/sentry",
                },
                {
                    "id": "2",
                    "name_with_namespace": "GetSentry2 / Sentry2",
                    "path_with_namespace": "getsentry2/sentry2",
                },
            ],
        )
        resp = self.client.get(self.url, data={"field": "project", "query": "GetSentry"})

        assert resp.status_code == 200
        assert resp.data == [
            {"value": "1", "label": "GetSentry / Sentry"},
            {"value": "2", "label": "GetSentry2 / Sentry2"},
        ]

    @responses.activate
    def test_finds_project_results_with_pagination(self):
        project_a = {
            "id": "1",
            "name_with_namespace": "GetSentry / Sentry",
            "path_with_namespace": "getsentry/sentry",
        }
        project_b = {
            "id": "2",
            "name_with_namespace": "GetSentry2 / Sentry2",
            "path_with_namespace": "getsentry2/sentry2",
        }

        def request_callback(request):
            query = parse_qs(request.url.split("?")[1])
            # allow for 220 responses
            if int(query["page"][0]) >= 3:
                projects = [project_a, project_b] * 10
            else:
                projects = [project_a, project_b] * 50
            return (200, {}, json.dumps(projects))

        responses.add_callback(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/1/projects",
            callback=request_callback,
        )
        resp = self.client.get(self.url, data={"field": "project", "query": "GetSentry"})

        assert resp.status_code == 200
        assert resp.data[0] == {"value": "1", "label": "GetSentry / Sentry"}
        assert resp.data[1] == {"value": "2", "label": "GetSentry2 / Sentry2"}

        assert len(resp.data) == 220

    @responses.activate
    def test_finds_no_external_issues_results(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/5/issues?scope=all&search=XYZ",
            json=[],
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "XYZ", "project": "5"}
        )

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_finds_no_external_issues_results_iid(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/5/issues?scope=all&iids=11",
            json=[],
        )
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "11", "project": "5"}
        )

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_finds_no_project_results(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/groups/1/projects?search=GetSentry&simple=True&include_subgroups=False&page=1&per_page=100&order_by=last_activity_at",
            json=[],
        )
        resp = self.client.get(self.url, data={"field": "project", "query": "GetSentry"})

        assert resp.status_code == 200
        assert resp.data == []

    # Request Validations
    def test_missing_field(self):
        resp = self.client.get(self.url, data={"query": "XYZ"})
        assert resp.status_code == 400

    def test_missing_query(self):
        resp = self.client.get(self.url, data={"query": "GetSentry"})

        assert resp.status_code == 400

    def test_invalid_field(self):
        resp = self.client.get(self.url, data={"field": "bad-field", "query": "GetSentry"})

        assert resp.status_code == 400

    @responses.activate
    def test_missing_project_with_external_issue_field(self):
        responses.add(
            responses.GET,
            "https://example.gitlab.com/api/v4/projects/5/issues?scope=all&search=AEIOU",
            json=[
                {"iid": 25, "title": "AEIOU Error", "project_id": "5"},
                {"iid": 45, "title": "AEIOU Error", "project_id": "5"},
            ],
        )
        resp = self.client.get(self.url, data={"field": "externalIssue", "query": "AEIOU"})

        assert resp.status_code == 400

    # Missing Resources
    def test_missing_integration(self):
        url = reverse(
            "sentry-extensions-gitlab-search",
            kwargs={"organization_slug": self.organization.slug, "integration_id": "1234567890"},
        )
        resp = self.client.get(url, data={"field": "project", "query": "GetSentry"})

        assert resp.status_code == 404

    def test_missing_installation(self):
        # remove organization integration aka "uninstalling" installation
        org_integration = OrganizationIntegration.objects.get(
            id=self.installation.org_integration.id
        )
        org_integration.delete()
        resp = self.client.get(self.url, data={"field": "project", "query": "GetSentry"})

        assert resp.status_code == 404

    # Distributed System Issues
    @responses.activate
    def test_search_issues_request_fails(self):
        responses.add(responses.GET, "https://example.gitlab.com/api/v4/issues", status=503)
        resp = self.client.get(
            self.url, data={"field": "externalIssue", "query": "GetSentry", "project": "5"}
        )
        assert resp.status_code == 400

    def test_projects_request_fails(self):
        responses.add(responses.GET, "https://example.gitlab.com/api/v4/projects", status=503)
        resp = self.client.get(self.url, data={"field": "project", "query": "GetSentry"})
        assert resp.status_code == 400
