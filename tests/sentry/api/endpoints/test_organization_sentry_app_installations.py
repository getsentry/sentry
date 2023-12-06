from sentry.api.fields.sentry_slug import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.testutils.cases import APITestCase
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
                "organization": {"slug": self.org.slug},
                "uuid": self.installation2.uuid,
                "code": self.installation2.api_grant.code,
                "status": "installed",
            }
        ]

        response = self.get_success_response(self.super_org.slug, status_code=200)

        assert response.data == [
            {
                "app": {"slug": self.published_app.slug, "uuid": self.published_app.uuid},
                "organization": {"slug": self.super_org.slug},
                "uuid": self.installation.uuid,
                "code": self.installation.api_grant.code,
                "status": "installed",
            }
        ]

    def test_users_only_sees_installs_on_their_org(self):
        self.login_as(user=self.user)
        response = self.get_success_response(self.org.slug, status_code=200)

        assert response.data == [
            {
                "app": {"slug": self.unpublished_app.slug, "uuid": self.unpublished_app.uuid},
                "organization": {"slug": self.org.slug},
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

    def test_install_unpublished_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = {
            "app": {"slug": app.slug, "uuid": app.uuid},
            "organization": {"slug": self.org.slug},
        }

        assert expected.items() <= response.data.items()

    def test_install_published_app(self):
        self.login_as(user=self.user)
        app = self.create_sentry_app(name="Sample", organization=self.org, published=True)
        response = self.get_success_response(self.org.slug, slug=app.slug, status_code=200)
        expected = {
            "app": {"slug": app.slug, "uuid": app.uuid},
            "organization": {"slug": self.org.slug},
        }

        assert expected.items() <= response.data.items()

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
