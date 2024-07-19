from sentry.auth.staff import is_active_staff
from sentry.receivers.staff import disable_staff
from sentry.testutils.cases import TestCase


class StaffReceiverTest(TestCase):
    def test_disable_staff_active_upon_logout(self):
        staff_user = self.create_user(is_staff=True)
        staff_request = self.make_request(user=staff_user, is_staff=True)

        assert is_active_staff(staff_request)
        disable_staff(request=staff_request, user=staff_user)
        assert not is_active_staff(staff_request)
