from django.conf import settings
from django.test import override_settings

from sentry.demo.tasks import delete_users_orgs, build_up_org_buffer
from sentry.demo.models import DemoOrganization, DemoUser, DemoOrgStatus
from sentry.models import Organization, User
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.compat import mock


# fix buffer size at 3
ORG_BUFFER_SIZE = 3
DEMO_DATA_GEN_PARAMS = settings.DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_GEN_PARAMS["ORG_BUFFER_SIZE"] = ORG_BUFFER_SIZE


@override_settings(DEMO_MODE=True, DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS)
class DemoTaskBaseClass(TestCase):
    def create_demo_org(self, org_args=None, **kwargs):
        org = self.create_organization(**(org_args or {}))
        DemoOrganization.objects.create(organization=org, **kwargs)
        return org

    def create_demo_user(self, user_args=None, **kwargs):
        user = self.create_user(**(user_args or {}))
        DemoUser.objects.create(user=user, **kwargs)
        return user


class DeleteUsersOrgTest(DemoTaskBaseClass):
    def test_delete_success(self):
        date_assigned = before_now(hours=30)

        org = self.create_demo_org(date_assigned=date_assigned, status=DemoOrgStatus.ACTIVE)
        user = self.create_demo_user(date_assigned=date_assigned)

        with self.tasks():
            delete_users_orgs()

        assert not Organization.objects.filter(id=org.id).exists()
        assert not User.objects.filter(id=user.id).exists()

    @override_settings(DEMO_MODE=False)
    def test_demo_mode_disabled(self):
        date_assigned = before_now(hours=30)

        org = self.create_demo_org(date_assigned=date_assigned, status=DemoOrgStatus.ACTIVE)
        user = self.create_demo_user(date_assigned=date_assigned)

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()
        assert User.objects.filter(id=user.id).exists()

    def test_recently_created(self):
        date_assigned = before_now(hours=20)

        org = self.create_demo_org(date_assigned=date_assigned, status=DemoOrgStatus.ACTIVE)
        user = self.create_demo_user(date_assigned=date_assigned)

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()
        assert User.objects.filter(id=user.id).exists()

    def test_pending_org(self):
        date_assigned = before_now(hours=30)
        org = self.create_demo_org(date_assigned=date_assigned, status=DemoOrgStatus.PENDING)

        with self.tasks():
            delete_users_orgs()

        assert Organization.objects.filter(id=org.id).exists()


class BuildUpOrgBufferTest(DemoTaskBaseClass):
    @mock.patch("sentry.demo.tasks.create_demo_org")
    def test_add_one_fill_buffer(self, mock_create_demo_org):
        for i in range(ORG_BUFFER_SIZE - 1):
            # pending an initializing orgs both count
            status = DemoOrgStatus.INITIALIZING if i % 1 == 0 else DemoOrgStatus.PENDING
            self.create_demo_org(status=status)

        # active orgs shoudn't count
        self.create_demo_org(status=DemoOrgStatus.ACTIVE)

        mock_create_demo_org.side_effect = self.create_demo_org

        with self.tasks():
            build_up_org_buffer()

        assert (
            ORG_BUFFER_SIZE
            == DemoOrganization.objects.filter(
                status__in=[DemoOrgStatus.PENDING, DemoOrgStatus.INITIALIZING]
            ).count()
        )
        mock_create_demo_org.assert_called_once_with()

    @mock.patch("sentry.demo.tasks.create_demo_org")
    def test_add_two_fill_buffer(self, mock_create_demo_org):
        for i in range(ORG_BUFFER_SIZE - 2):
            # pending an initializing orgs both count
            status = DemoOrgStatus.INITIALIZING if i % 1 == 0 else DemoOrgStatus.PENDING
            self.create_demo_org(status=status)

        mock_create_demo_org.side_effect = self.create_demo_org

        with self.tasks():
            build_up_org_buffer()

        assert (
            ORG_BUFFER_SIZE
            == DemoOrganization.objects.filter(
                status__in=[DemoOrgStatus.PENDING, DemoOrgStatus.INITIALIZING]
            ).count()
        )
        assert mock_create_demo_org.call_count == 2

    @mock.patch("sentry.demo.tasks.create_demo_org")
    def test_buffer_full(self, mock_create_demo_org):
        for i in range(ORG_BUFFER_SIZE):
            self.create_demo_org()

        mock_create_demo_org.side_effect = self.create_demo_org

        with self.tasks():
            build_up_org_buffer()

        assert mock_create_demo_org.call_count == 0
