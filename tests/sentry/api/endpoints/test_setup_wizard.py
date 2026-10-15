from urllib.parse import parse_qs, urlparse

from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY
from sentry.cache import default_cache
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class SetupWizardTest(APITestCase):
    def test_simple(self) -> None:
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["hash"]

    def test_anonymous(self) -> None:
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        response = self.client.get(url)
        assert response.status_code == 200, response.content

    def test_fill_and_read(self) -> None:
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        self.login_as(user=self.user)

        response = self.client.get(url)
        wizard_hash = response.data["hash"]
        assert response.status_code == 200, response.content
        assert wizard_hash

        url2 = reverse("sentry-api-0-project-wizard", kwargs={"wizard_hash": wizard_hash})

        response2 = self.client.get(url2)
        assert response2.status_code == 400, response2.content

        # Delete content of cache
        self.client.delete(url2)

        response5 = self.client.get(url2)
        assert response5.status_code == 404, response5.content


@control_silo_test
class SetupWizardSessionTest(APITestCase):
    endpoint = "sentry-api-0-project-wizard-session"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.cache_key = f"{SETUP_WIZARD_CACHE_KEY}session-hash"
        default_cache.set(self.cache_key, "empty", 600)

    def test_pending(self) -> None:
        response = self.get_success_response("session-hash")
        assert response.data == {"status": "pending"}

    def test_expired(self) -> None:
        response = self.get_success_response("expired-hash")
        assert response.data == {"status": "expired"}

    def test_initialize_project(self) -> None:
        project = self.create_project(organization=self.organization)
        response = self.get_success_response(
            "session-hash",
            method="post",
            organizationSlug=self.organization.slug,
            projectSlug=project.slug,
        )
        assert response.data == {"status": "selected"}
        cached = default_cache.get(self.cache_key)
        assert cached["projects"][0]["id"] == project.id
        assert cached["apiKeys"]["scopes"] == ["org:ci"]
        self.get_success_response("session-hash")

    def test_initialize_selected_session(self) -> None:
        project = self.create_project(organization=self.organization)
        self.get_success_response(
            "session-hash", method="put", organizationId=self.organization.id, projectId=project.id
        )
        response = self.get_success_response(
            "session-hash",
            method="post",
            organizationSlug=self.organization.slug,
            projectSlug=project.slug,
        )
        assert response.data == {"status": "selected"}
        assert OrgAuthToken.objects.filter(organization_id=self.organization.id).count() == 1

    def test_initialize_without_preselection(self) -> None:
        response = self.get_success_response("session-hash", method="post")
        assert response.data == {"status": "pending"}
        assert default_cache.get(self.cache_key) == "empty"

    def test_initialize_unknown_project(self) -> None:
        response = self.get_success_response(
            "session-hash",
            method="post",
            organizationSlug=self.organization.slug,
            projectSlug="missing-project",
        )
        assert response.data == {"status": "pending"}
        assert default_cache.get(self.cache_key) == "empty"

    def test_initialize_project_in_other_organization(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        response = self.get_success_response(
            "session-hash",
            method="post",
            organizationSlug=self.organization.slug,
            projectSlug=other_project.slug,
        )
        assert response.data == {"status": "pending"}
        assert default_cache.get(self.cache_key) == "empty"

    def test_initialize_organization_without_membership(self) -> None:
        project = self.create_project(organization=self.create_organization())
        response = self.get_success_response(
            "session-hash",
            method="post",
            organizationSlug=project.organization.slug,
            projectSlug=project.slug,
        )
        assert response.data == {"status": "pending"}
        assert default_cache.get(self.cache_key) == "empty"

    def test_select_project(self) -> None:
        project = self.create_project(organization=self.organization)
        response = self.get_success_response(
            "session-hash", method="put", organizationId=self.organization.id, projectId=project.id
        )
        assert response.data == {"status": "selected"}
        cached = default_cache.get(self.cache_key)
        assert cached["projects"][0]["id"] == project.id
        response = self.get_success_response("session-hash")
        assert response.data == {"status": "selected"}

    def test_select_project_without_membership(self) -> None:
        project = self.create_project(organization=self.create_organization())
        self.get_error_response(
            "session-hash",
            method="put",
            organizationId=project.organization.id,
            projectId=project.id,
            status_code=404,
        )
        assert default_cache.get(self.cache_key) == "empty"

    def test_select_project_in_other_organization(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        self.get_error_response(
            "session-hash",
            method="put",
            organizationId=self.organization.id,
            projectId=other_project.id,
            status_code=404,
        )
        assert default_cache.get(self.cache_key) == "empty"

    def test_select_project_without_dsn(self) -> None:
        project = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CELL):
            project.key_set.all().delete()
        response = self.get_error_response(
            "session-hash",
            method="put",
            organizationId=self.organization.id,
            projectId=project.id,
            status_code=404,
        )
        assert response.data == {"detail": "No DSN found for this project"}

    def test_select_expired_session(self) -> None:
        project = self.create_project(organization=self.organization)
        self.get_error_response(
            "expired-hash",
            method="put",
            organizationId=self.organization.id,
            projectId=project.id,
            status_code=404,
        )
        assert default_cache.get(f"{SETUP_WIZARD_CACHE_KEY}expired-hash") is None
        assert OrgAuthToken.objects.filter(organization_id=self.organization.id).count() == 0

    def test_invalid_project_ids(self) -> None:
        self.get_error_response(
            "session-hash", method="put", organizationId="invalid", projectId=1, status_code=400
        )

    def test_missing_project_id(self) -> None:
        self.get_error_response(
            "session-hash", method="put", organizationId=self.organization.id, status_code=400
        )

    def test_anonymous_login(self) -> None:
        self.client.logout()
        response = self.get_success_response(
            "session-hash", partner="partner-slug", org_slug="org-slug"
        )
        assert response.data["status"] == "unauthenticated"
        destination = urlparse(response.data["redirectUrl"])
        assert destination.path == "/auth/login/"
        query = parse_qs(destination.query)
        assert query["partner"] == ["partner-slug"]
        assert query["org_slug"] == ["org-slug"]
        next_uri = urlparse(query["next"][0])
        assert next_uri.path == "/account/settings/wizard/session-hash/"
        assert parse_qs(next_uri.query)["org_slug"] == ["org-slug"]

    @override_settings(SENTRY_SIGNUP_URL="https://sentry.io/signup/")
    def test_anonymous_signup(self) -> None:
        self.client.logout()
        response = self.get_success_response(
            "session-hash", signup="1", project_platform="javascript-nextjs"
        )
        destination = urlparse(response.data["redirectUrl"])
        assert destination.netloc == "sentry.io"
        assert destination.path == "/signup/"
        query = parse_qs(destination.query)
        assert query["project_platform"] == ["javascript-nextjs"]
        next_uri = urlparse(query["next"][0])
        assert next_uri.path == "/account/settings/wizard/session-hash/"

    def test_anonymous_cannot_initialize(self) -> None:
        self.client.logout()
        self.get_error_response("session-hash", method="post", status_code=403)
        assert default_cache.get(self.cache_key) == "empty"

    def test_anonymous_cannot_select(self) -> None:
        project = self.create_project(organization=self.organization)
        self.client.logout()
        self.get_error_response(
            "session-hash",
            method="put",
            organizationId=self.organization.id,
            projectId=project.id,
            status_code=403,
        )
        assert default_cache.get(self.cache_key) == "empty"

    def test_demo_user(self) -> None:
        with override_options({"demo-mode.enabled": True, "demo-mode.users": [self.user.id]}):
            self.get_error_response("session-hash", status_code=403)
            self.get_error_response("session-hash", method="post", status_code=403)
            self.get_error_response("session-hash", method="put", status_code=403)

    def test_impersonation_cannot_select_project(self) -> None:
        project = self.create_project(organization=self.organization)
        impersonator = self.create_user(is_superuser=True)
        with simulate_impersonation(impersonator):
            self.get_error_response(
                "session-hash",
                method="put",
                organizationId=self.organization.id,
                projectId=project.id,
                status_code=403,
            )
        assert default_cache.get(self.cache_key) == "empty"

    def test_completed_session(self) -> None:
        project = self.create_project(organization=self.organization)
        self.get_success_response(
            "session-hash", method="put", organizationId=self.organization.id, projectId=project.id
        )
        cli_url = reverse("sentry-api-0-project-wizard", args=["session-hash"])
        response = self.client.delete(cli_url)
        assert response.status_code == 200
        response = self.client.get(cli_url)
        assert response.status_code == 404
        response = self.get_success_response("session-hash")
        assert response.data == {"status": "completed"}

    def test_deleting_unknown_session(self) -> None:
        cli_url = reverse("sentry-api-0-project-wizard", args=["unknown-hash"])
        response = self.client.delete(cli_url)
        assert response.status_code == 200
        response = self.get_success_response("unknown-hash")
        assert response.data == {"status": "expired"}
