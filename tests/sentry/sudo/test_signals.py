from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in, user_logged_out

from fixtures.sudo_testutils import BaseTestCase
from sudo.signals import grant, revoke
from sudo.utils import grant_sudo_privileges, has_sudo_privileges


class SignalsTestCase(BaseTestCase):
    def test_grant(self):
        self.login()
        grant(User, self.request)
        self.assertTrue(has_sudo_privileges(self.request))

    def test_revoke(self):
        self.login()
        grant(User, self.request)
        revoke(User, self.request)
        self.assertFalse(has_sudo_privileges(self.request))

    def test_user_logged_in(self):
        self.login()
        user_logged_in.send_robust(sender=User, request=self.request)
        self.assertTrue(has_sudo_privileges(self.request))

    def test_user_logged_out(self):
        self.login()
        grant_sudo_privileges(self.request)
        self.assertTrue(has_sudo_privileges(self.request))
        user_logged_out.send_robust(sender=User, request=self.request)
        self.assertFalse(has_sudo_privileges(self.request))
