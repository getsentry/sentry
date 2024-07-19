from django.conf import settings

from sentry.models.userrole import UserRole, manage_default_super_admin_role
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserRoleTest(TestCase):
    def setUp(self) -> None:
        manage_default_super_admin_role()

    def test_creates_super_admin_role(self):
        role = UserRole.objects.get(name="Super Admin")
        assert sorted(role.permissions) == sorted(settings.SENTRY_USER_PERMISSIONS)
