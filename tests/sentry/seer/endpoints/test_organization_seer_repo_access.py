from __future__ import annotations

from typing import Any

from django.test import override_settings
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.models.repository import REPOSITORY_NAME_LENGTH, Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context

FEATURE = "organizations:ask-seer-scm-connect-prompt"
SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


# Seer is off on self-hosted installs, which tests run as by default.
@override_settings(SENTRY_SELF_HOSTED=False, SEER_API_SHARED_SECRET=SECRET)
@with_feature([FEATURE, "organizations:seer-explorer"])
class OrganizationSeerRepoAccessTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-repo-access"

    def _get(
        self, repo_name: str = "acme-labs/app", *, logged_in: bool = True, **kwargs: Any
    ) -> Response:
        if logged_in:
            self.login_as(self.user)
        response: Response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/seer/repo-access/",
            {"repoName": repo_name},
            **kwargs,
        )
        return response

    def _connect_github(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
            name="acme-labs",
            metadata={"domain_name": "github.com/acme-labs"},
        )

    def _add_repo(self) -> None:
        Repository.objects.create(
            organization_id=self.organization.id,
            name="acme-labs/app",
            url="https://github.com/acme-labs/app",
            provider="integrations:github",
            external_id="1",
        )

    def test_no_scm_integration(self) -> None:
        response = self._get()

        assert response.status_code == 200
        assert response.data == {"status": "no_scm_integration", "connectedAccounts": []}

    def test_scm_account_not_connected(self) -> None:
        self._connect_github()

        response = self._get("other-org/app")

        assert response.status_code == 200
        assert response.data == {
            "status": "scm_account_not_connected",
            "connectedAccounts": ["acme-labs"],
        }

    def test_repo_not_in_sentry(self) -> None:
        self._connect_github()

        response = self._get()

        assert response.status_code == 200
        assert response.data == {"status": "repo_not_in_sentry", "connectedAccounts": ["acme-labs"]}

    def test_found_once_the_repo_reaches_sentry(self) -> None:
        self._connect_github()
        self._add_repo()

        response = self._get()

        # Only the outcome: none of the repository's details.
        assert response.status_code == 200
        assert response.data == {"status": "found", "connectedAccounts": []}

    def test_unknown_when_the_reason_cant_be_named(self) -> None:
        # A name with no owner can't be under any account, so Sentry can't say why it missed.
        self._connect_github()

        response = self._get("app")

        assert response.status_code == 200
        assert response.data == {"status": "unknown", "connectedAccounts": []}

    def test_repo_name_is_required(self) -> None:
        self.login_as(self.user)
        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/seer/repo-access/"
        )

        assert response.status_code == 400

    def test_repo_name_too_long(self) -> None:
        response = self._get("a" * (REPOSITORY_NAME_LENGTH + 1))

        assert response.status_code == 400

    def test_feature_off_is_not_found(self) -> None:
        with self.feature({FEATURE: False}):
            response = self._get()

        assert response.status_code == 404

    def test_refused_without_seer_agent_access(self) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        response = self._get()

        assert response.status_code == 403

    def test_member_can_check(self) -> None:
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)

        response = self._get(logged_in=False)

        assert response.status_code == 200
        assert response.data == {"status": "no_scm_integration", "connectedAccounts": []}

    def test_another_organizations_integration_and_repo_dont_count(self) -> None:
        other = self.create_organization(owner=self.create_user())
        self.create_integration(
            organization=other,
            provider="github",
            external_id="github:1",
            name="acme-labs",
            metadata={"domain_name": "github.com/acme-labs"},
        )
        Repository.objects.create(
            organization_id=other.id,
            name="acme-labs/app",
            url="https://github.com/acme-labs/app",
            provider="integrations:github",
            external_id="1",
        )

        response = self._get()

        assert response.status_code == 200
        assert response.data == {"status": "no_scm_integration", "connectedAccounts": []}

    def test_an_install_shared_with_another_organization_counts_only_where_active(self) -> None:
        # One GitHub install can be linked to several organizations. It's disabled here.
        integration = self.create_integration(
            organization=self.create_organization(owner=self.create_user()),
            provider="github",
            external_id="github:1",
            name="acme-labs",
            metadata={"domain_name": "github.com/acme-labs"},
        )
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=integration,
            status=ObjectStatus.DISABLED,
        )

        response = self._get()

        assert response.status_code == 200
        assert response.data == {"status": "no_scm_integration", "connectedAccounts": []}

    def test_api_token_is_refused(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=["org:read"])

        response = self._get(logged_in=False, HTTP_AUTHORIZATION=f"Bearer {token.token}")

        assert response.status_code == 403

    def test_viewer_context_is_refused(self) -> None:
        context = encode_viewer_context(
            ViewerContext(actor=Actor(type=ActorType.USER, actor_id=self.user.id)), key=SECRET
        )

        response = self._get(logged_in=False, HTTP_X_VIEWER_CONTEXT=context)

        assert response.status_code == 403
