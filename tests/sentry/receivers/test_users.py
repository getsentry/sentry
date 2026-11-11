from unittest import mock

from django.test.utils import override_settings

from sentry.receivers.users import DEV_ADMIN_EMAIL, create_dev_admin
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User


@control_silo_test
@mock.patch("sentry.receivers.users.in_test_environment", return_value=False)
class CreateDevAdminTest(TestCase):
    @override_settings(DEBUG=True)
    def test_creates_superuser_once(self, _: mock.MagicMock) -> None:
        with self.assertLogs("sentry.audit.user") as logs:
            create_dev_admin()
            create_dev_admin()

        user = User.objects.get(username=DEV_ADMIN_EMAIL)
        assert user.is_superuser
        assert user.check_password("admin")
        assert [r.user_id for r in logs.records] == [user.id]  # type: ignore[attr-defined]

    @override_settings(DEBUG=False)
    def test_skips_without_debug(self, _: mock.MagicMock) -> None:
        create_dev_admin()
        assert not User.objects.filter(username=DEV_ADMIN_EMAIL).exists()
