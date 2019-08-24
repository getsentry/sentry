from __future__ import absolute_import, print_function

from sentry.models import PlatformExternalIssue
from sentry.testutils import APITestCase


class GroupExternalIssueDetailsEndpointTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.group = self.create_group()
        self.external_issue = self.create_platform_external_issue(
            group=self.group,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )

        self.url = u"/api/0/issues/{}/external-issues/{}/".format(
            self.group.id, self.external_issue.id
        )

    def test_deletes_external_issue(self):
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 204, response.content
        assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_handles_non_existing_external_issue(self):
        url = u"/api/0/issues/{}/external-issues/{}/".format(self.group.id, 99999)

        response = self.client.delete(url, format="json")

        assert response.status_code == 404, response.content

    def test_forbids_deleting_an_inaccessible_issue(self):
        group = self.create_group(
            project=self.create_project(
                organization=self.create_organization(
                    owner=self.create_user()  # Not the logged in User
                )
            )
        )

        external_issue = self.create_platform_external_issue(
            group=group,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )

        url = u"/api/0/issues/{}/external-issues/{}/".format(group.id, external_issue.id)

        response = self.client.delete(url, format="json")

        assert response.status_code == 403, response.content
