from sentry.api.serializers.base import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class SentryAppsStatsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-apps-stats"
    method = "get"

    def setUp(self):
        self.superuser = self.create_user(is_superuser=True)
        self.org_two = self.create_organization()

        self.app_one = self.create_sentry_app(
            name="Test", organization=self.org_two, published=True
        )
        self.app_one_avatar = self.create_sentry_app_avatar(
            sentry_app=self.app_one, color=True, avatar_type=0
        )
        self.app_two = self.create_sentry_app(name="Testin", organization=self.organization)

        self.create_sentry_app_installation(slug=self.app_one.slug, organization=self.organization)
        self.create_sentry_app_installation(slug=self.app_two.slug, organization=self.organization)

    def _check_response(self, response):
        assert {
            "id": self.app_two.id,
            "uuid": self.app_two.uuid,
            "slug": self.app_two.slug,
            "name": self.app_two.name,
            "installs": 1,
            "avatars": [],
        } in json.loads(response.content)
        assert {
            "id": self.app_one.id,
            "uuid": self.app_one.uuid,
            "slug": self.app_one.slug,
            "name": self.app_one.name,
            "installs": 1,
            "avatars": [serialize(self.app_one_avatar)],
        } in json.loads(response.content)

    def test_superuser_has_access(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status_code=200)
        self._check_response(response)

    @with_feature("auth:enterprise-staff-cookie")
    def test_staff_has_access(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        response = self.get_success_response(status_code=200)
        self._check_response(response)

    def test_nonsuperusers_have_no_access(self):
        self.login_as(user=self.user)
        self.get_error_response(status_code=403)

    def test_per_page(self):
        self.login_as(user=self.superuser, superuser=True)

        self.create_sentry_app_installation(
            slug=self.app_one.slug, organization=self.create_organization()
        )

        for i in range(3):
            app = self.create_sentry_app(
                name=f"Test {i}", organization=self.org_two, published=True
            )

            self.create_sentry_app_installation(slug=app.slug, organization=self.organization)

        response = self.get_success_response(per_page=2, status_code=200)

        assert len(response.data) == 2  # honors per_page
        assert response.data[0]["installs"] == 2  # sorted by installs
