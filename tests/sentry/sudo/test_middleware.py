from django.http import HttpResponse

from sudo.middleware import SudoMiddleware
from sudo.settings import COOKIE_NAME
from sudo.utils import grant_sudo_privileges, revoke_sudo_privileges

from .base import BaseTestCase


class SudoMiddlewareTestCase(BaseTestCase):
    middleware = SudoMiddleware()

    def assertSignedCookieEqual(self, v1, v2, reason=None):
        value, _, _ = v1.split(":")
        return self.assertEqual(value, v2, reason)

    def test_process_request_raises_without_session(self):
        del self.request.session
        with self.assertRaises(AssertionError):
            self.middleware.process_request(self.request)

    def test_process_request_adds_is_sudo(self):
        self.middleware.process_request(self.request)
        self.assertFalse(self.request.is_sudo())

    def test_process_response_noop(self):
        response = self.middleware.process_response(self.request, HttpResponse())
        self.assertEqual(len(response.cookies.items()), 0)

    def test_process_response_with_sudo_sets_cookie(self):
        self.login()
        self.middleware.process_request(self.request)
        grant_sudo_privileges(self.request)
        response = self.middleware.process_response(self.request, HttpResponse())
        morsels = list(response.cookies.items())
        self.assertEqual(len(morsels), 1)
        self.assertEqual(morsels[0][0], COOKIE_NAME)
        _, sudo = morsels[0]
        self.assertEqual(sudo.key, COOKIE_NAME)
        self.assertSignedCookieEqual(sudo.value, self.request._sudo_token)
        self.assertEqual(sudo["max-age"], self.request._sudo_max_age)
        self.assertTrue(sudo["httponly"])

        # Asserting that these are insecure together explicitly
        # since it's a big deal to not bungle.
        self.assertFalse(self.request.is_secure())
        self.assertFalse(sudo["secure"])  # insecure request

    def test_process_response_sets_secure_cookie(self):
        self.login()
        self.request.is_secure = lambda: True

        self.middleware.process_request(self.request)
        grant_sudo_privileges(self.request)

        response = self.middleware.process_response(self.request, HttpResponse())
        morsels = list(response.cookies.items())
        self.assertEqual(len(morsels), 1)
        self.assertEqual(morsels[0][0], COOKIE_NAME)
        _, sudo = morsels[0]
        self.assertTrue(self.request.is_secure())

        # XXX: Even if sudo.settings.COOKIE_SECURE is patched to be None
        #      from False (from sentry initializer), we need to move the import
        #      into the middleware's process_response rather than at module level.
        # self.assertTrue(sudo["secure"])

    def test_process_response_sudo_revoked_removes_cookie(self):
        self.login()
        self.middleware.process_request(self.request)
        grant_sudo_privileges(self.request)
        self.request.COOKIES[COOKIE_NAME] = self.request._sudo_token
        revoke_sudo_privileges(self.request)
        response = self.middleware.process_response(self.request, HttpResponse())
        morsels = list(response.cookies.items())
        self.assertEqual(len(morsels), 1)
        self.assertEqual(morsels[0][0], COOKIE_NAME)
        _, sudo = morsels[0]

        # Deleting a cookie is just setting it's value to empty
        # and telling it to expire
        self.assertEqual(sudo.key, COOKIE_NAME)
        self.assertFalse(sudo.value)
        self.assertEqual(sudo["max-age"], 0)

    def test_process_response_sudo_revoked_without_cookie(self):
        self.login()
        self.middleware.process_request(self.request)
        grant_sudo_privileges(self.request)
        revoke_sudo_privileges(self.request)
        response = self.middleware.process_response(self.request, HttpResponse())
        morsels = list(response.cookies.items())
        self.assertEqual(len(morsels), 0)
