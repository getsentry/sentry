from sentry.hybridcloud.models.foo import update_user_to_be_foo
from sentry.testutils.cases import TestCase


class TestFoo(TestCase):
    def test_update_user_to_be_foo(self):
        user = self.create_user(email="test@example.com")
        update_user_to_be_foo(user.id)
