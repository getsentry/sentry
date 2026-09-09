from sentry.models.apitoken import ApiToken
from sentry.models.organization import Organization
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test


@control_silo_test
class SentryAppInstallationExternalIssueDetailsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installation-external-issue-details"
    method = "delete"

    def setUp(self) -> None:
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.group = self.create_group(project=self.project)

        self.sentry_app = self.create_sentry_app(
            name="testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["event:admin"],
        )
        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )
        self.external_issue = self.create_platform_external_issue(
            group=self.group,
            service_type=self.sentry_app.slug,
            display_name="App#issue-1",
            web_url=self.sentry_app.webhook_url,
        )
        self.login_as(self.user)

    def test_deletes_external_issue(self) -> None:
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
        self.get_success_response(self.install.uuid, self.external_issue.id, status_code=204)
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert not PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def _assert_token_unlink(
        self, token: ApiToken, expected_status: int, link_exists: bool
    ) -> None:
        self.client.cookies.clear()
        response = self.get_response(
            self.install.uuid,
            self.external_issue.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert response.status_code == expected_status, response.content
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert (
                PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
                is link_exists
            )

    def test_deletes_external_issue_with_writer_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:write"])
        self._assert_token_unlink(token, 204, False)

    def test_deletes_external_issue_with_admin_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:admin"])
        self._assert_token_unlink(token, 204, False)

    def test_rejects_read_only_user_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])
        self._assert_token_unlink(token, 403, True)

    def _create_app_token(self, scope: str) -> ApiToken:
        self.sentry_app.update(scope_list=[scope])
        self.install.refresh_from_db()
        token = self.create_internal_integration_token(install=self.install, user=self.user)
        assert token.user_id == self.sentry_app.proxy_user_id
        return token

    def test_deletes_external_issue_with_app_writer_token(self) -> None:
        token = self._create_app_token("event:write")
        assert token.scope_list == ["event:read", "event:write"]
        self._assert_token_unlink(token, 204, False)

    def test_deletes_external_issue_with_app_admin_token(self) -> None:
        token = self._create_app_token("event:admin")
        assert token.scope_list == ["event:admin", "event:read", "event:write"]
        self._assert_token_unlink(token, 204, False)

    def test_rejects_read_only_app_token(self) -> None:
        token = self._create_app_token("event:read")
        assert token.scope_list == ["event:read"]
        self._assert_token_unlink(token, 403, True)

    def test_rejects_token_from_different_app(self) -> None:
        other_app = self.create_sentry_app(
            name="other-app", organization=self.org, scopes=["event:write"]
        )
        other_install = self.create_sentry_app_installation(
            organization=self.org, slug=other_app.slug, user=self.user
        )
        token = self.create_internal_integration_token(install=other_install, user=self.user)
        self._assert_token_unlink(token, 403, True)

    def test_rejects_issue_from_different_app(self) -> None:
        other_app = self.create_sentry_app(
            name="other-app", organization=self.org, scopes=["event:write"]
        )
        other_install = self.create_sentry_app_installation(
            organization=self.org, slug=other_app.slug, user=self.user
        )

        self.get_error_response(other_install.uuid, self.external_issue.id, status_code=404)

        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_member_with_write_scope_can_unlink(self) -> None:
        team = self.create_team(organization=self.org)
        with assume_test_silo_mode_of(Organization):
            self.org.flags.allow_joinleave = False
            self.org.save()
            self.org.update_option("sentry:events_member_admin", False)
            self.project.add_team(team)
        member = self.create_user()
        self.create_member(organization=self.org, user=member, role="member", teams=[team])
        token = self.create_user_auth_token(user=member, scope_list=["event:write"])
        self._assert_token_unlink(token, 204, False)

    def test_handles_non_existing_external_issue(self) -> None:
        self.get_error_response(self.install.uuid, 999999, status_code=404)

    def test_handles_issue_from_wrong_org(self) -> None:
        """
        Ensure that an outside organization cannot delete another organization's external issue
        """

        evil_user = self.create_user(email="moop@example.com")
        evil_org = self.create_organization(owner=evil_user)

        evil_sentry_app = self.create_sentry_app(
            name="bad-stuff",
            organization=evil_org,
            webhook_url="https://example.com",
            scopes=["event:admin"],
        )
        evil_install = self.create_sentry_app_installation(
            organization=evil_org, slug=evil_sentry_app.slug, user=evil_user
        )

        self.get_error_response(evil_install.uuid, self.external_issue.id, status_code=404)
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_handles_member_without_project_access(self) -> None:
        """
        Ensure that a member fenced out of the issue's project cannot delete its external issue
        """
        with assume_test_silo_mode_of(Organization):
            self.org.flags.allow_joinleave = False
            self.org.save()
            self.org.update_option("sentry:events_member_admin", False)

        member_team = self.create_team(organization=self.org)
        self.create_project(organization=self.org, teams=[member_team])
        restricted_member = self.create_user(email="restricted@example.com")
        self.create_member(
            organization=self.org, user=restricted_member, role="member", teams=[member_team]
        )
        token = self.create_user_auth_token(user=restricted_member, scope_list=["event:write"])
        self.client.cookies.clear()

        response = self.get_error_response(
            self.install.uuid,
            self.external_issue.id,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            status_code=403,
        )
        assert (
            response.data["detail"] == "You do not have permission to delete this external issue."
        )
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()

    def test_handles_invalid_external_issue_id_format(self) -> None:
        """Test that non-numeric external_issue_id returns 400 error"""
        # Non-numeric string
        self.get_error_response(self.install.uuid, "test-issue-id-123", status_code=400)

        # Ensure the external issue still exists after failed attempts
        with assume_test_silo_mode_of(PlatformExternalIssue):
            assert PlatformExternalIssue.objects.filter(id=self.external_issue.id).exists()
