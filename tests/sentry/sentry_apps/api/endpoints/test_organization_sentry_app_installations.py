from typing import Any
from unittest.mock import ANY, patch

from django.test import override_settings

from sentry.constants import SentryAppStatus
from sentry.integrations.models.integration_feature import Feature
from sentry.models.organization import Organization, OrganizationStatus
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.impl import DatabaseBackedOrganizationService
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.testutils.asserts import assert_no_organization_resource_hydration
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE


class SentryAppInstallationsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installations"

    def setUp(self) -> None:
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.published_app = self.create_sentry_app(
            name="Test", organization=self.super_org, published=True
        )
        self.unpublished_app = self.create_sentry_app(name="Testin", organization=self.org)

        self.installation = self.create_sentry_app_installation(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
            prevent_token_exchange=True,
        )
        self.installation2 = self.create_sentry_app_installation(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
            prevent_token_exchange=True,
        )


@control_silo_test
class GetSentryAppInstallationsTest(SentryAppInstallationsTest):
    method = "get"

    def test_superuser_sees_all_installs(self) -> None:
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(self.org.slug, status_code=200)

        assert response.data == [
            {
                "app": {
                    "slug": self.unpublished_app.slug,
                    "uuid": self.unpublished_app.uuid,
                    "sentryAppId": self.unpublished_app.id,
                },
                "organization": {"slug": self.org.slug, "id": self.org.id},
                "uuid": self.installation2.uuid,
                "code": self.installation2.api_grant.code,
                "status": "installed",
            }
        ]

        response = self.get_success_response(self.super_org.slug, status_code=200)

        assert response.data == [
            {
                "app": {
                    "slug": self.published_app.slug,
                    "uuid": self.published_app.uuid,
                    "sentryAppId": self.published_app.id,
                },
                "organization": {"slug": self.super_org.slug, "id": self.super_org.id},
                "uuid": self.installation.uuid,
                "code": self.installation.api_grant.code,
                "status": "installed",
            }
        ]

        # also works for SaaS
        with self.settings(SENTRY_SELF_HOSTED=False):
            response = self.get_success_response(self.org.slug, status_code=200)
            response = self.get_success_response(self.super_org.slug, status_code=200)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_superuser_read_and_write_sees_all_installs(self) -> None:
        # test SaaS only
        self.login_as(user=self.superuser, superuser=True)
        self.get_success_response(self.org.slug, status_code=200)
        self.get_success_response(self.super_org.slug, status_code=200)

        self.add_user_permission(self.superuser, "superuser.write")

        self.get_success_response(self.org.slug, status_code=200)
        self.get_success_response(self.super_org.slug, status_code=200)

    def test_users_only_sees_installs_on_their_org(self) -> None:
        self._assert_member_installations(
            "slug", "get_access_context_by_slug", {"slug": self.org.slug, "only_visible": False}
        )

    def test_users_only_sees_installs_on_their_org_by_id(self) -> None:
        self._assert_member_installations(
            "id", "get_access_context", {"organization_id": self.org.id}
        )

    def _assert_member_installations(
        self, identifier: str, method: str, lookup: dict[str, Any]
    ) -> None:
        self.login_as(user=self.user)
        self.create_project(organization=self.org)
        self.create_team(organization=self.org)
        with (
            assert_no_organization_resource_hydration(),
            patch.object(
                DatabaseBackedOrganizationService,
                method,
                autospec=True,
                side_effect=getattr(DatabaseBackedOrganizationService, method),
            ) as get_context,
            patch.object(organization_service, "get_org_by_slug") as get_summary_by_slug,
            patch.object(organization_service, "get_org_by_id") as get_summary_by_id,
        ):
            response = self.get_success_response(getattr(self.org, identifier), status_code=200)
        get_context.assert_called_once_with(
            ANY, **lookup, user_id=self.user.id, include_resource_ids=False
        )
        get_summary_by_slug.assert_not_called()
        get_summary_by_id.assert_not_called()

        assert response.data == [
            {
                "app": {
                    "slug": self.unpublished_app.slug,
                    "uuid": self.unpublished_app.uuid,
                    "sentryAppId": self.unpublished_app.id,
                },
                "organization": {"slug": self.org.slug, "id": self.org.id},
                "uuid": self.installation2.uuid,
                "code": self.installation2.api_grant.code,
                "status": "installed",
            }
        ]

        # Org the User is not a part of
        response = self.get_error_response(getattr(self.super_org, identifier), status_code=404)
        assert response.status_code == 404

        with assume_test_silo_mode_of(Organization):
            self.org.update(status=OrganizationStatus.PENDING_DELETION)
        self.get_error_response(getattr(self.org, identifier), status_code=404)


@control_silo_test
class PostSentryAppInstallationsTest(SentryAppInstallationsTest):
    method = "post"

    def get_expected_response(self, app: SentryApp, org: Organization) -> dict[str, Any]:
        installation = SentryAppInstallation.objects.get(sentry_app=app, organization_id=org.id)
        assert installation.api_grant is not None
        return {
            "app": {"slug": app.slug, "uuid": app.uuid, "sentryAppId": app.id},
            "organization": {"slug": org.slug, "id": org.id},
            "code": installation.api_grant.code,
        }

    def test_install_unpublished_app(self) -> None:
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = self.get_expected_response(app, self.org)

        assert expected.items() <= response.data.items()

    def test_install_published_app(self) -> None:
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org, published=True)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = self.get_expected_response(app, self.org)

        assert expected.items() <= response.data.items()

    def test_install_published_app_by_other_org(self) -> None:
        user2 = self.create_user("foo@example.com")
        org2 = self.create_organization(owner=user2)
        self.login_as(user=user2)

        response = self.get_success_response(
            org2.slug, slug=self.published_app.slug, status_code=200
        )
        expected = self.get_expected_response(self.published_app, org2)

        assert expected.items() <= response.data.items()

    def test_install_superuser(self) -> None:
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

        with self.settings(SENTRY_SELF_HOSTED=False):
            app = self.create_sentry_app(name="Sample 2", organization=self.org, published=True)
            self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

    def test_can_install_unpublished_unowned_app_as_superuser(self) -> None:
        self.login_as(user=self.user)
        org2 = self.create_organization()
        app2 = self.create_sentry_app(name="Unpublished", organization=org2)

        self.login_as(user=self.superuser, superuser=True)
        self.get_success_response(self.org.slug, slug=app2.slug, status_code=200)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_install_superuser_read(self) -> None:
        self.login_as(user=self.superuser, superuser=True)

        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_error_response(self.org.slug, slug=app.slug, status_code=403)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_install_superuser_write(self) -> None:
        self.login_as(user=self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "superuser.write")

        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

    def test_members_cannot_install_apps(self) -> None:
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.org, user=user, role="member")
        self.login_as(user)
        app = self.create_sentry_app(name="Sample", organization=self.org, published=True)
        self.get_error_response(self.org.slug, slug=app.slug, status_code=403)

    def test_install_twice(self) -> None:
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

        assert SentryAppInstallation.objects.filter(sentry_app=app).count() == 1
        assert response.status_code == 200

    def test_invalid_numeric_slug(self) -> None:
        self.login_as(user=self.user)
        response = self.get_error_response(self.org.slug, slug="1234", status_code=400)
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_cannot_install_nonexistent_app(self) -> None:
        self.login_as(user=self.user)
        self.get_error_response(self.org.slug, slug="nonexistent", status_code=404)

    def test_cannot_install_unpublished_unowned_app(self) -> None:
        self.login_as(user=self.user)
        org2 = self.create_organization()
        app2 = self.create_sentry_app(name="Unpublished", organization=org2)
        self.get_error_response(self.org.slug, slug=app2.slug, status_code=404)

    def test_cannot_install_other_org_internal_app(self) -> None:
        self.login_as(user=self.user)
        org2 = self.create_organization()
        internal_app = self.create_internal_integration(name="Internal App", organization=org2)
        self.get_error_response(self.org.slug, slug=internal_app.slug, status_code=404)

    @with_feature({"organizations:integrations-alert-rule": False})
    def test_disallow_app_with_all_features_disabled(self) -> None:
        # prepare an app with paid features
        app = self.unpublished_app
        SentryAppUpdater(sentry_app=app, features=[Feature.ALERTS]).run(user=self.user)
        app.update(status=SentryAppStatus.PUBLISHED)

        # test on a free-tier org
        user2 = self.create_user("free@example.com")
        org2 = self.create_organization(owner=user2)
        self.login_as(user=user2)

        response = self.get_error_response(org2.slug, slug=app.slug, status_code=403)
        assert response.data == {
            "detail": "At least one feature from this list has to be enabled in order to install the app",
            "missing_features": ["organizations:integrations-alert-rule"],
        }
