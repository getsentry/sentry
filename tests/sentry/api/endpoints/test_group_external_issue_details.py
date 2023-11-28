from sentry.models.platformexternalissue import PlatformExternalIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
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

        self.url = f"/api/0/issues/{self.group.id}/external-issues/{self.external_issue.id}/"

    def test_deletes_external_issue(self):
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 204, response.content
        assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_handles_non_existing_external_issue(self):
        url = f"/api/0/issues/{self.group.id}/external-issues/99999/"

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

        url = f"/api/0/issues/{group.id}/external-issues/{external_issue.id}/"

        response = self.client.delete(url, format="json")

        assert response.status_code == 403, response.content
