from __future__ import absolute_import

from sentry.models import UserPermission
from sentry.testutils import TestCase


class UserPermissionTest(TestCase):
    def test_for_user(self):
        user = self.create_user(email="a@example.com")
        user2 = self.create_user(email="b@example.com")
        UserPermission.objects.create(user=user, permission="test")
        UserPermission.objects.create(user=user, permission="test2")
        UserPermission.objects.create(user=user2, permission="test3")
        assert sorted(UserPermission.for_user(user.id)) == ["test", "test2"]
