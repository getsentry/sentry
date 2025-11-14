from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.analytics.events.org_redirect import OrgRedirectEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestOrgRedirect(TestCase):
    def test_unauthenticated(self) -> None:
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.client.get(url, format="json", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [("/auth/login/", 302)]

    def test_no_last_active_org(self) -> None:
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.client.get(url, format="json", follow=True)
        assert response.status_code == 200
        # Redirects to organization creation
        assert ("/organizations/new/", 302) in response.redirect_chain

    @with_feature("system:multi-region")
    def test_path_redirect(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.client.get(url, format="json", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (org.absolute_url(f"/settings/{org.slug}/integrations/?param=test"), 302)
        ]

    @with_feature("system:multi-region")
    def test_path_redirect_case_insensitive(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__OrGslUg__/integrations/?param=test"
        )
        response = self.client.get(url, format="json", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (org.absolute_url(f"/settings/{org.slug}/integrations/?param=test"), 302)
        ]

    @with_feature("system:multi-region")
    def test_colon_path_redirect(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/:orgslug/integrations/?param=test"
        )
        response = self.client.get(url, format="json", follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [
            (org.absolute_url(f"/settings/{org.slug}/integrations/?param=test"), 302)
        ]

    @patch("sentry.analytics.record")
    def test_analytics_org(self, mock_record: MagicMock) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/:orgslug/integrations/?param=test"
        )
        self.client.get(url, format="json")
        assert_last_analytics_event(
            mock_record,
            OrgRedirectEvent(
                user_id=self.user.id,
                organization_id=org.id,
                path=url,
            ),
        )

    @patch("sentry.analytics.record")
    def test_analytics_no_org(self, mock_record: MagicMock) -> None:
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/:orgslug/integrations/?param=test"
        )
        self.client.get(url, format="json")
        assert_last_analytics_event(
            mock_record,
            OrgRedirectEvent(
                user_id=self.user.id,
                path=url,
            ),
        )


@control_silo_test
class TestOrgRedirectCustomerDomain(TestCase):
    def get_response(self, url, SERVER_NAME=None):
        if SERVER_NAME is None:
            SERVER_NAME = "albertos-apples.testserver"
        return self.client.get(url, format="json", follow=True, SERVER_NAME=SERVER_NAME)

    def test_unauthenticated(self) -> None:
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.get_response(url)
        assert response.status_code == 200
        assert response.redirect_chain == [("/auth/login/", 302)]

    def test_no_last_active_org(self) -> None:
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.get_response(url)
        assert response.status_code == 200
        # Should redirect to org creation
        assert ("http://testserver/organizations/new/", 302) in response.redirect_chain

    def test_path_redirect(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        response = self.get_response(url, SERVER_NAME=f"{org.slug}.testserver")
        assert response.status_code == 200
        assert response.redirect_chain == [
            (
                f"http://{org.slug}.testserver/settings/integrations/?param=test",
                302,
            ),
        ]

    def test_path_redirect_with_customer_domain_feature(self) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/__orgSlug__/integrations/?param=test"
        )
        with self.feature({"system:multi-region": True}):
            response = self.client.get(url, format="json", follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [
                (
                    f"http://{org.slug}.testserver/settings/integrations/?param=test",
                    302,
                ),
            ]

    @patch("sentry.analytics.record")
    def test_analytics_org(self, mock_record: MagicMock) -> None:
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/:orgslug/integrations/?param=test"
        )
        response = self.get_response(url, SERVER_NAME=f"{org.slug}.testserver")
        assert response.status_code == 200
        assert response.redirect_chain == [
            (
                f"http://{org.slug}.testserver/settings/integrations/?param=test",
                302,
            ),
        ]
        assert_last_analytics_event(
            mock_record,
            OrgRedirectEvent(
                user_id=self.user.id,
                organization_id=org.id,
                path=url,
            ),
        )

    @patch("sentry.analytics.record")
    def test_analytics_no_org(self, mock_record: MagicMock) -> None:
        self.login_as(self.user)
        url = (
            reverse(
                "sentry-org-redirect",
            )
            + "settings/:orgslug/integrations/?param=test"
        )
        response = self.get_response(url)
        assert response.status_code == 200
        # Should redirect to org creation
        assert ("http://testserver/organizations/new/", 302) in response.redirect_chain

        assert_last_analytics_event(
            mock_record,
            OrgRedirectEvent(
                user_id=self.user.id,
                path=url,
            ),
        )
