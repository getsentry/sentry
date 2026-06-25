import datetime

from django.utils import timezone

from sentry.api.serializers.base import serialize
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


def _has_subset(item: dict, expected: dict) -> bool:
    """Return True if all keys in expected are present and equal in item."""
    return all(item.get(k) == v for k, v in expected.items())


@control_silo_test
class SentryAppsStatsTest(APITestCase):
    endpoint = "sentry-api-0-sentry-apps-stats"
    method = "get"

    def setUp(self) -> None:
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

    def _assert_app_in_response(self, response_data: list, expected: dict) -> None:
        """Assert that at least one item in response_data is a superset of expected."""
        assert any(
            _has_subset(item, expected) for item in response_data
        ), f"No item matching {expected} found in response:\n{response_data}"

    def _check_response(self, response_data: list) -> None:
        self._assert_app_in_response(
            response_data,
            {
                "id": self.app_two.id,
                "uuid": self.app_two.uuid,
                "slug": self.app_two.slug,
                "name": self.app_two.name,
                "status": "unpublished",
                "installs": 1,
                "uninstalls": 0,
                "avatars": [],
            },
        )
        self._assert_app_in_response(
            response_data,
            {
                "id": self.app_one.id,
                "uuid": self.app_one.uuid,
                "slug": self.app_one.slug,
                "name": self.app_one.name,
                "status": "published",
                "installs": 1,
                "uninstalls": 0,
                "avatars": [serialize(self.app_one_avatar)],
            },
        )

    @override_options({"staff.ga-rollout": False})
    def test_superuser_has_access(self) -> None:
        self.login_as(user=self.superuser, superuser=True)
        response = self.get_success_response(status_code=200)
        self._check_response(response.data)

    @override_options({"staff.ga-rollout": True})
    def test_staff_has_access(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)
        response = self.get_success_response(status_code=200)
        self._check_response(response.data)

    @override_options({"staff.ga-rollout": True})
    def test_nonsuperusers_have_no_access(self) -> None:
        self.login_as(user=self.user)
        self.get_error_response(status_code=403)

    @override_options({"staff.ga-rollout": True})
    def test_per_page(self) -> None:
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

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
        assert response.data[0]["installs"] == 2  # sorted by installs desc

    @override_options({"staff.ga-rollout": True})
    def test_status_filter_published(self) -> None:
        """Only published apps are returned when status=published."""
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        response = self.get_success_response(status="published", status_code=200)

        slugs = [item["slug"] for item in response.data]
        assert self.app_one.slug in slugs  # published
        assert self.app_two.slug not in slugs  # unpublished

    @override_options({"staff.ga-rollout": True})
    def test_sort_by_uninstalls(self) -> None:
        """sortBy=uninstalls orders results by uninstall count descending."""
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        # Uninstall app_one's installation by soft-deleting it.
        installation = self.app_one.installations.first()
        installation.delete()

        response = self.get_success_response(sortBy="uninstalls", status_code=200)

        assert response.data[0]["slug"] == self.app_one.slug
        assert response.data[0]["uninstalls"] == 1

    @override_options({"staff.ga-rollout": True})
    def test_period_filter(self) -> None:
        """
        Installs created before the period window are excluded from counts
        when ?period is specified.
        """
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        # Back-date app_one's installation to outside any reasonable window.
        installation = self.app_one.installations.first()
        installation.date_added = timezone.now() - datetime.timedelta(days=180)
        installation.save(update_fields=["date_added"])

        response = self.get_success_response(period="30d", status_code=200)

        # app_one's old install is outside the 30-day window; count should be 0.
        app_one_data = next(
            (item for item in response.data if item["slug"] == self.app_one.slug), None
        )
        assert app_one_data is not None
        assert app_one_data["installs"] == 0

        # app_two's install is recent; count should be 1.
        app_two_data = next(
            (item for item in response.data if item["slug"] == self.app_two.slug), None
        )
        assert app_two_data is not None
        assert app_two_data["installs"] == 1

    @override_options({"staff.ga-rollout": True})
    def test_owner_included_in_response(self) -> None:
        """Each app row includes the owner's id and slug."""
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        response = self.get_success_response(status_code=200)

        app_one_data = next(
            (item for item in response.data if item["slug"] == self.app_one.slug), None
        )
        assert app_one_data is not None
        assert app_one_data["owner"] is not None
        assert app_one_data["owner"]["slug"] == self.org_two.slug
