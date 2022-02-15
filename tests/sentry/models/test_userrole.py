from django.conf import settings

from sentry.models import UserRole
from sentry.testutils import TestCase


class UserRoleTest(TestCase):
    def test_permissions_for_user(self):
        user = self.create_user(email="a@example.com")
        user2 = self.create_user(email="b@example.com")
        role = UserRole.objects.create(name="test", permissions=["test1", "test2"])
        role.users.add(user)
        role2 = UserRole.objects.create(name="test2", permissions=["test2", "test3"])
        role2.users.add(user)
        assert sorted(UserRole.permissions_for_user(user.id)) == ["test1", "test2", "test3"]
        assert sorted(UserRole.permissions_for_user(user2.id)) == []

    def test_creates_super_admin_role(self):
        role = UserRole.objects.get(name="Super Admin")
        assert sorted(role.permissions) == sorted(settings.SENTRY_USER_PERMISSIONS)
