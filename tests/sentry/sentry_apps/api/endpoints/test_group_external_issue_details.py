from sentry.issues.action_log import ActionSource
from sentry.models.group import Group
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.testutils.cases import APITestCase


class GroupExternalIssueDetailsEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)

        self.group = self.create_group()
        self.external_issue = self.create_platform_external_issue(
            group=self.group,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )

        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/external-issues/{self.external_issue.id}/"

    def test_deletes_external_issue(self) -> None:
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 204, response.content
        assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
        assert Group.objects.get(id=self.group.id).status == self.group.status

    def _assert_unlink_with_token_scope(
        self, scope: str, expected_status: int, link_exists: bool
    ) -> None:
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        token = self.create_user_auth_token(user=user, scope_list=[scope])
        self.client.cookies.clear()

        response = self.client.delete(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )

        assert response.status_code == expected_status, response.content
        assert (
            PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists() is link_exists
        )
        assert Group.objects.get(id=self.group.id).status == self.group.status

    def test_token_with_event_write_can_unlink(self) -> None:
        self._assert_unlink_with_token_scope("event:write", 204, False)

    def test_token_with_event_admin_can_unlink(self) -> None:
        self._assert_unlink_with_token_scope("event:admin", 204, False)

    def test_token_with_event_read_cannot_unlink(self) -> None:
        self._assert_unlink_with_token_scope("event:read", 403, True)

    def test_member_without_event_admin_can_unlink(self) -> None:
        self.organization.update_option("sentry:events_member_admin", False)
        user = self.create_user()
        self.create_member(
            user=user, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(user=user)

        response = self.client.delete(self.url, format="json")

        assert response.status_code == 204, response.content
        assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
        assert Group.objects.get(id=self.group.id).status == self.group.status

    def test_token_cannot_unlink_without_project_access(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        user = self.create_user()
        self.create_member(user=user, organization=self.organization, role="member", teams=[])
        token = self.create_user_auth_token(user=user, scope_list=["event:write"])
        self.client.cookies.clear()

        response = self.client.delete(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )

        assert response.status_code == 403, response.content
        assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
        assert Group.objects.get(id=self.group.id).status == self.group.status

    def test_deletes_external_issue_records_action_log(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            response = self.client.delete(self.url, format="json")

        assert response.status_code == 204, response.content

        records = [
            r
            for r in logs.records
            if r.message == "group.action_log"
            and getattr(r, "action") == "unlink_platform_external_issue"
        ]
        assert len(records) == 1
        record = records[0]
        assert getattr(record, "source") == ActionSource.WEB
        assert getattr(record, "actor_id") == str(self.user.id)
        assert getattr(record, "group_id") == str(self.group.id)
        assert getattr(record, "metadata") == {
            "service_type": "sentry-app",
            "display_name": "App#issue-1",
            "web_url": "https://example.com/app/issues/1",
        }

    def test_handles_non_existing_external_issue(self) -> None:
        url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/external-issues/99999/"

        response = self.client.delete(url, format="json")

        assert response.status_code == 404, response.content

    def test_forbids_deleting_an_inaccessible_issue(self) -> None:
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

        url = f"/api/0/organizations/{group.project.organization.slug}/issues/{group.id}/external-issues/{external_issue.id}/"

        response = self.client.delete(url, format="json")

        assert response.status_code == 403, response.content
        assert PlatformExternalIssue.objects.filter(id=external_issue.id).exists()
        assert Group.objects.get(id=group.id).status == group.status
