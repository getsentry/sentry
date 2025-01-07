from django.test import override_settings

from sentry.constants import SentryAppStatus
from sentry.integrations.models.integration_feature import Feature
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


class SentryAppInstallationsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-app-installations"

    def setUp(self):
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

    def test_superuser_sees_all_installs(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(self.org.slug, status_code=200)

        assert response.data == [
            {
                "app": {"slug": self.unpublished_app.slug, "uuid": self.unpublished_app.uuid},
                "organization": {"slug": self.org.slug, "id": self.org.id},
                "uuid": self.installation2.uuid,
                "code": self.installation2.api_grant.code,
                "status": "installed",
            }
        ]

        response = self.get_success_response(self.super_org.slug, status_code=200)

        assert response.data == [
            {
                "app": {"slug": self.published_app.slug, "uuid": self.published_app.uuid},
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
    def test_superuser_read_and_write_sees_all_installs(self):
        # test SaaS only
        self.login_as(user=self.superuser, superuser=True)
        self.get_success_response(self.org.slug, status_code=200)
        self.get_success_response(self.super_org.slug, status_code=200)

        self.add_user_permission(self.superuser, "superuser.write")

        self.get_success_response(self.org.slug, status_code=200)
        self.get_success_response(self.super_org.slug, status_code=200)

    def test_users_only_sees_installs_on_their_org(self):
        self.login_as(user=self.user)
        response = self.get_success_response(self.org.slug, status_code=200)

        assert response.data == [
            {
                "app": {"slug": self.unpublished_app.slug, "uuid": self.unpublished_app.uuid},
                "organization": {"slug": self.org.slug, "id": self.org.id},
                "uuid": self.installation2.uuid,
                "code": self.installation2.api_grant.code,
                "status": "installed",
            }
        ]

        # Org the User is not a part of
        response = self.get_error_response(self.super_org.slug, status_code=404)
        assert response.status_code == 404


@control_silo_test
class PostSentryAppInstallationsTest(SentryAppInstallationsTest):
    method = "post"

    def get_expected_response(self, app, org):
        installation = SentryAppInstallation.objects.get(sentry_app=app, organization_id=org.id)
        assert installation.api_grant is not None
        return {
            "app": {"slug": app.slug, "uuid": app.uuid},
            "organization": {"slug": org.slug, "id": org.id},
            "code": installation.api_grant.code,
        }

    def test_install_unpublished_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = self.get_expected_response(app, self.org)

        assert expected.items() <= response.data.items()

    def test_install_published_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org, published=True)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = self.get_expected_response(app, self.org)

        assert expected.items() <= response.data.items()

    def test_install_published_app_by_other_org(self):
        user2 = self.create_user("foo@example.com")
        org2 = self.create_organization(owner=user2)
        self.login_as(user=user2)

        response = self.get_success_response(
            org2.slug, slug=self.published_app.slug, status_code=200
        )
        expected = self.get_expected_response(self.published_app, org2)

        assert expected.items() <= response.data.items()

    def test_install_superuser(self):
        self.login_as(user=self.superuser, superuser=True)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

        with self.settings(SENTRY_SELF_HOSTED=False):
            app = self.create_sentry_app(name="Sample 2", organization=self.org, published=True)
            self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

    def test_can_install_unpublished_unowned_app_as_superuser(self):
        self.login_as(user=self.user)
        org2 = self.create_organization()
        app2 = self.create_sentry_app(name="Unpublished", organization=org2)

        self.login_as(user=self.superuser, superuser=True)
        self.get_success_response(self.org.slug, slug=app2.slug, status_code=200)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_install_superuser_read(self):
        self.login_as(user=self.superuser, superuser=True)

        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_error_response(self.org.slug, slug=app.slug, status_code=403)

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_install_superuser_write(self):
        self.login_as(user=self.superuser, superuser=True)
        self.add_user_permission(self.superuser, "superuser.write")

        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

    def test_members_cannot_install_apps(self):
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.org, user=user, role="member")
        self.login_as(user)
        app = self.create_sentry_app(name="Sample", organization=self.org, published=True)
        self.get_error_response(self.org.slug, slug=app.slug, status_code=403)

    def test_install_twice(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)

        assert SentryAppInstallation.objects.filter(sentry_app=app).count() == 1
        assert response.status_code == 200

    def test_invalid_numeric_slug(self):
        self.login_as(user=self.user)
        response = self.get_error_response(self.org.slug, slug="1234", status_code=400)
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_cannot_install_nonexistent_app(self):
        self.login_as(user=self.user)
        self.get_error_response(self.org.slug, slug="nonexistent", status_code=404)

    def test_cannot_install_unpublished_unowned_app(self):
        self.login_as(user=self.user)
        org2 = self.create_organization()
        app2 = self.create_sentry_app(name="Unpublished", organization=org2)
        self.get_error_response(self.org.slug, slug=app2.slug, status_code=404)

    def test_cannot_install_other_org_internal_app(self):
        self.login_as(user=self.user)
        org2 = self.create_organization()
        internal_app = self.create_internal_integration(name="Internal App", organization=org2)
        self.get_error_response(self.org.slug, slug=internal_app.slug, status_code=404)

    @with_feature({"organizations:integrations-alert-rule": False})
    def test_disallow_app_with_all_features_disabled(self):
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
