from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.userrole import UserRole


@control_silo_test
class UserRoleTest(TestCase):
    def test_create_role(self) -> None:
        role = UserRole.objects.create(name="test-role", permissions=["users.admin"])
        assert role.name == "test-role"
        assert role.permissions == ["users.admin"]
