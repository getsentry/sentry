import pytest
from django.core.signing import BadSignature

from fixtures.sudo_testutils import BaseTestCase
from sudo.settings import COOKIE_AGE, COOKIE_NAME
from sudo.utils import grant_sudo_privileges, has_sudo_privileges, revoke_sudo_privileges


class GrantSudoPrivilegesTestCase(BaseTestCase):
    def assertRequestHasToken(self, request, max_age):
        token = request.session[COOKIE_NAME]

        self.assertRegex(token, r"^\w{12}$")
        self.assertTrue(request._sudo)
        self.assertEqual(request._sudo_token, token)
        self.assertEqual(request._sudo_max_age, max_age)

    def test_grant_token_not_logged_in(self):
        with pytest.raises(ValueError):
            grant_sudo_privileges(self.request)

    def test_grant_token_default_max_age(self):
        self.login()
        token = grant_sudo_privileges(self.request)
        self.assertIsNotNone(token)
        self.assertRequestHasToken(self.request, COOKIE_AGE)

    def test_grant_token_explicit_max_age(self):
        self.login()
        token = grant_sudo_privileges(self.request, 60)
        self.assertIsNotNone(token)
        self.assertRequestHasToken(self.request, 60)

    def test_without_user(self):
        delattr(self.request, "user")
        token = grant_sudo_privileges(self.request)
        self.assertIsNone(token)


class RevokeSudoPrivilegesTestCase(BaseTestCase):
    def assertRequestNotSudo(self, request):
        self.assertFalse(self.request._sudo)
        self.assertNotIn(COOKIE_NAME, self.request.session)

    def test_revoke_sudo_privileges_noop(self):
        revoke_sudo_privileges(self.request)
        self.assertRequestNotSudo(self.request)

    def test_revoke_sudo_privileges(self):
        self.login()
        grant_sudo_privileges(self.request)
        revoke_sudo_privileges(self.request)
        self.assertRequestNotSudo(self.request)


class HasSudoPrivilegesTestCase(BaseTestCase):
    def test_untouched(self):
        self.assertFalse(has_sudo_privileges(self.request))

    def test_granted(self):
        self.login()
        grant_sudo_privileges(self.request)
        self.assertTrue(has_sudo_privileges(self.request))

    def test_revoked(self):
        self.login()
        grant_sudo_privileges(self.request)
        revoke_sudo_privileges(self.request)
        self.assertFalse(has_sudo_privileges(self.request))

    def test_cookie_and_token_match(self):
        self.login()

        def get_signed_cookie(key, salt="", max_age=None):
            return "abc123"

        self.request.session[COOKIE_NAME] = "abc123"
        self.request.get_signed_cookie = get_signed_cookie
        self.assertTrue(has_sudo_privileges(self.request))

    def test_cookie_and_token_mismatch(self):
        self.login()

        def get_signed_cookie(key, salt="", max_age=None):
            return "nope"

        self.request.session[COOKIE_NAME] = "abc123"
        self.request.get_signed_cookie = get_signed_cookie
        self.assertFalse(has_sudo_privileges(self.request))

    def test_cookie_bad_signature(self):
        self.login()

        def get_signed_cookie(key, salt="", max_age=None):
            raise BadSignature

        self.request.session[COOKIE_NAME] = "abc123"
        self.request.get_signed_cookie = get_signed_cookie
        self.assertFalse(has_sudo_privileges(self.request))

    def test_missing_keys(self):
        self.login()
        self.assertFalse(has_sudo_privileges(self.request))
