from .base import BaseTestCase
from sudo.signals import grant, revoke
from sudo.utils import has_sudo_privileges, grant_sudo_privileges
from django.contrib.auth.models import User
from django.contrib.auth.signals import user_logged_in, user_logged_out


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
