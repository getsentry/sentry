from django.test import override_settings

from sentry.demo.tasks import delete_users_orgs
from sentry.models import Organization, User
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now


class DeleteUsersOrgTest(TestCase):
    def test_delete_success(self):
        created_date = before_now(hours=30)
        org = self.create_organization(
            date_added=created_date,
            flags=Organization.flags["demo_mode"],
        )

        user = self.create_user(date_joined=created_date, flags=User.flags["demo_mode"])

        with self.tasks():
            delete_users_orgs()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not User.objects.filter(id=user.id).exists()

    @override_settings(DEMO_MODE=False)
    def test_demo_mode_disabled(self):
        created_date = before_now(hours=30)
        org = self.create_organization(
            date_added=created_date,
            flags=Organization.flags["demo_mode"],
        )

        user = self.create_user(date_joined=created_date, flags=User.flags["demo_mode"])

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()
        assert User.objects.filter(id=user.id).exists()

    def test_recently_created(self):
        created_date = before_now(hours=20)
        org = self.create_organization(
            date_added=created_date,
            flags=Organization.flags["demo_mode"],
        )

        user = self.create_user(date_joined=created_date, flags=User.flags["demo_mode"])

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()
        assert User.objects.filter(id=user.id).exists()

    def test_no_flag(self):
        created_date = before_now(hours=30)
        org = self.create_organization(
            date_added=created_date,
        )

        user = self.create_user(date_joined=created_date, flags=0)

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()
        assert User.objects.filter(id=user.id).exists()
