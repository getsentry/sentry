from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse
from .testutils import GitLabTestCase


class GitlabSearchTest(GitLabTestCase):
    provider = 'gitlab'

    def setUp(self):
        super(GitlabSearchTest, self).setUp()
        self.url = reverse(
            'sentry-extensions-gitlab-search',
            kwargs={
                'organization_slug': self.organization.slug,
                'integration_id': self.installation.model.id,
            }
        )

    # Happy Paths
    @responses.activate
    def test_finds_external_issue_results(self):
        responses.add(
            responses.GET,
            'https://example.gitlab.com/api/v4/groups/42/issues?scope=all&search=AEIOU',
            json=[
                {'iid': 25, 'title': 'AEIOU Error', 'project_id': '1'},
                {'iid': 45, 'title': 'AEIOU Error', 'project_id': '2'}
            ]
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'externalIssue',
                'query': 'AEIOU',
            }
        )

        assert resp.status_code == 200
        assert resp.data == [
            {'value': '1#25', 'label': '(#25) AEIOU Error'},
            {'value': '2#45', 'label': '(#45) AEIOU Error'}
        ]

    @responses.activate
    def test_finds_project_results(self):
        responses.add(
            responses.GET,
            'https://example.gitlab.com/api/v4/groups/42/projects?query=GetSentry&simple=True',
            json=[
                {
                    'id': '1',
                    'name_with_namespace': 'GetSentry / Sentry',
                    'path_with_namespace': 'getsentry/sentry'
                },
                {
                    'id': '2',
                    'name_with_namespace': 'GetSentry2 / Sentry2',
                    'path_with_namespace': 'getsentry2/sentry2'
                },
            ]
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'project',
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 200
        assert resp.data == [
            {'value': '1', 'label': 'GetSentry / Sentry'},
            {'value': '2', 'label': 'GetSentry2 / Sentry2'}
        ]

    @responses.activate
    def test_finds_no_external_issues_results(self):
        responses.add(
            responses.GET,
            'https://example.gitlab.com/api/v4/groups/42/issues?scope=all&search=XYZ',
            json=[]
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'externalIssue',
                'query': 'XYZ',
            }
        )

        assert resp.status_code == 200
        assert resp.data == []

    @responses.activate
    def test_finds_no_project_results(self):
        responses.add(
            responses.GET,
            'https://example.gitlab.com/api/v4/groups/42/projects?query=GetSentry&simple=True',
            json=[]
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'project',
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 200
        assert resp.data == []

    # Request Validations
    def test_missing_field(self):
        resp = self.client.get(
            self.url,
            data={
                'query': 'XYZ',
            }
        )
        assert resp.status_code == 400

    def test_missing_query(self):
        resp = self.client.get(
            self.url,
            data={
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 400

    def test_invalid_field(self):
        resp = self.client.get(
            self.url,
            data={
                'field': 'bad-field',
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 400

    # Missing Resources
    def test_missing_integration(self):
        url = reverse(
            'sentry-extensions-gitlab-search',
            kwargs={
                'organization_slug': self.organization.slug,
                'integration_id': '1234567890',
            }
        )
        resp = self.client.get(
            url,
            data={
                'field': 'project',
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 404

    def test_missing_installation(self):
        # remove organization integration aka "uninstalling" installation
        self.installation.org_integration.delete()
        resp = self.client.get(
            self.url,
            data={
                'field': 'project',
                'query': 'GetSentry',
            }
        )

        assert resp.status_code == 404

    # Distributed System Issues
    @responses.activate
    def test_search_issues_request_fails(self):
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/issues',
            status=503
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'externalIssue',
                'query': 'GetSentry',
            }
        )
        assert resp.status_code == 500

    def test_projects_request_fails(self):
        responses.add(
            responses.GET, u'https://example.gitlab.com/api/v4/projects',
            status=503
        )
        resp = self.client.get(
            self.url,
            data={
                'field': 'project',
                'query': 'GetSentry',
            }
        )
        assert resp.status_code == 500
