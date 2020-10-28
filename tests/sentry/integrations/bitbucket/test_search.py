from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase


class BitbucketSearchEndpointTest(APITestCase):
    def setUp(self):
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = Integration.objects.create(
            provider="bitbucket",
            external_id=self.subject,
            name="meredithanya",
            metadata={
                "base_url": self.base_url,
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )

        self.login_as(self.user)
        self.integration.add_organization(self.organization, self.user)
        self.path = reverse(
            "sentry-extensions-bitbucket-search", args=[self.organization.slug, self.integration.id]
        )

    @responses.activate
    def test_search_issues(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya/apples/issues",
            json={
                "values": [
                    {"id": "123", "title": "Issue Title 123"},
                    {"id": "456", "title": "Issue Title 456"},
                ]
            },
        )
        resp = self.client.get(
            self.path,
            data={"field": "externalIssue", "query": "issue", "repo": "meredithanya/apples"},
        )

        assert resp.status_code == 200
        assert resp.data == [
            {"label": "#123 Issue Title 123", "value": "123"},
            {"label": "#456 Issue Title 456", "value": "456"},
        ]

    @responses.activate
    def test_search_repositories(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya",
            json={"values": [{"full_name": "meredithanya/apples"}]},
        )
        resp = self.client.get(self.path, data={"field": "repo", "query": "apple"})

        assert resp.status_code == 200
        assert resp.data == [{"label": "meredithanya/apples", "value": "meredithanya/apples"}]

    @responses.activate
    def test_search_repositories_no_issue_tracker(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/meredithanya/apples/issues",
            json={"type": "error", "error": {"message": "Repository has no issue tracker."}},
            status=404,
        )
        resp = self.client.get(
            self.path,
            data={"field": "externalIssue", "query": "issue", "repo": "meredithanya/apples"},
        )
        assert resp.status_code == 400
        assert resp.data == {"detail": "Bitbucket Repository has no issue tracker."}
