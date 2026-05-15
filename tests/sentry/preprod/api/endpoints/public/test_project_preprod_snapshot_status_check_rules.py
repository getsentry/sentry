from django.urls import reverse

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.preprod.vcs.status_checks.snapshots.config import (
    ENABLED_DEFAULT,
    ENABLED_OPTION_KEY,
    FAIL_ON_ADDED_DEFAULT,
    FAIL_ON_ADDED_OPTION_KEY,
    FAIL_ON_CHANGED_DEFAULT,
    FAIL_ON_CHANGED_OPTION_KEY,
    FAIL_ON_REMOVED_DEFAULT,
    FAIL_ON_REMOVED_OPTION_KEY,
    FAIL_ON_RENAMED_DEFAULT,
    FAIL_ON_RENAMED_OPTION_KEY,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ProjectPreprodSnapshotStatusCheckRulesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-snapshot-status-check-rules"

    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _get_url(self, organization_slug=None, project_slug=None):
        return reverse(
            self.endpoint,
            args=[organization_slug or self.organization.slug, project_slug or self.project.slug],
        )

    def _get_with_user_token(self, scope_list=None, user=None, url=None):
        token = self.create_user_auth_token(
            user or self.user,
            scope_list=scope_list or ["project:read"],
        )
        return self.client.get(url or self._get_url(), HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def _get_with_org_token(self, scope_list=None):
        token_str = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="Test Token",
                token_hashed=hash_token(token_str),
                scope_list=scope_list or ["project:distribution"],
            )
        return self.client.get(self._get_url(), HTTP_AUTHORIZATION=f"Bearer {token_str}")

    def test_default_config_returns_snapshot_rules_with_runtime_defaults(self) -> None:
        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {
            "enabled": True,
            "rules": {
                "failOnAdded": False,
                "failOnRemoved": True,
                "failOnChanged": True,
                "failOnRenamed": False,
            },
        }

    def test_returns_explicit_non_default_values(self) -> None:
        self.project.update_option(ENABLED_OPTION_KEY, False)
        self.project.update_option(FAIL_ON_ADDED_OPTION_KEY, True)
        self.project.update_option(FAIL_ON_REMOVED_OPTION_KEY, False)
        self.project.update_option(FAIL_ON_CHANGED_OPTION_KEY, False)
        self.project.update_option(FAIL_ON_RENAMED_OPTION_KEY, True)

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {
            "enabled": False,
            "rules": {
                "failOnAdded": True,
                "failOnRemoved": False,
                "failOnChanged": False,
                "failOnRenamed": True,
            },
        }

    def test_partial_config_falls_back_to_runtime_defaults(self) -> None:
        self.project.update_option(FAIL_ON_ADDED_OPTION_KEY, True)
        self.project.update_option(FAIL_ON_CHANGED_OPTION_KEY, False)

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {
            "enabled": True,
            "rules": {
                "failOnAdded": True,
                "failOnRemoved": True,
                "failOnChanged": False,
                "failOnRenamed": False,
            },
        }

    def test_denies_unauthenticated_request(self) -> None:
        response = self.client.get(self._get_url())

        assert response.status_code == 401

    def test_denies_token_without_expected_scope(self) -> None:
        response = self._get_with_user_token(scope_list=["event:read"])

        assert response.status_code == 403

    def test_allows_project_read_bearer_token(self) -> None:
        response = self._get_with_user_token(scope_list=["project:read"])

        assert response.status_code == 200

    def test_allows_project_read_org_token(self) -> None:
        response = self._get_with_org_token(scope_list=["project:read"])

        assert response.status_code == 200

    def test_denies_project_distribution_org_token(self) -> None:
        response = self._get_with_org_token(scope_list=["project:distribution"])

        assert response.status_code == 403

    def test_denies_other_organization_access(self) -> None:
        other_user = self.create_user()
        other_organization = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_organization)
        url = self._get_url(other_organization.slug, other_project.slug)

        response = self._get_with_user_token(user=self.user, url=url)

        assert response.status_code == 403

    def test_shared_status_check_config_defines_expected_runtime_defaults(self) -> None:
        assert ENABLED_OPTION_KEY == "sentry:preprod_snapshot_status_checks_enabled"
        assert FAIL_ON_ADDED_OPTION_KEY == "sentry:preprod_snapshot_status_checks_fail_on_added"
        assert FAIL_ON_REMOVED_OPTION_KEY == "sentry:preprod_snapshot_status_checks_fail_on_removed"
        assert FAIL_ON_CHANGED_OPTION_KEY == "sentry:preprod_snapshot_status_checks_fail_on_changed"
        assert FAIL_ON_RENAMED_OPTION_KEY == "sentry:preprod_snapshot_status_checks_fail_on_renamed"
        assert ENABLED_DEFAULT is True
        assert FAIL_ON_ADDED_DEFAULT is False
        assert FAIL_ON_REMOVED_DEFAULT is True
        assert FAIL_ON_CHANGED_DEFAULT is True
        assert FAIL_ON_RENAMED_DEFAULT is False
