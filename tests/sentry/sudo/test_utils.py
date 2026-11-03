from typing import cast

import pytest
from django.core.signing import BadSignature
from django.http import HttpRequest

from fixtures.sudo_testutils import BaseTestCase
from sudo.settings import COOKIE_AGE, COOKIE_NAME
from sudo.utils import (
    _SudoRequest,
    grant_sudo_privileges,
    has_sudo_privileges,
    revoke_sudo_privileges,
)


class GrantSudoPrivilegesTestCase(BaseTestCase):
    def assertRequestHasToken(self, request: HttpRequest, max_age: int) -> None:
        token = request.session[COOKIE_NAME]

        sudo_request = cast("_SudoRequest", request)
        self.assertRegex(token, r"^\w{12}$")
        self.assertTrue(sudo_request._sudo)
        self.assertEqual(sudo_request._sudo_token, token)
        self.assertEqual(sudo_request._sudo_max_age, max_age)

    def test_grant_token_not_logged_in(self) -> None:
        with pytest.raises(ValueError):
            grant_sudo_privileges(self.request)

    def test_grant_token_default_max_age(self) -> None:
        self.login()
        token = grant_sudo_privileges(self.request)
        self.assertIsNotNone(token)
        self.assertRequestHasToken(self.request, COOKIE_AGE)

    def test_grant_token_explicit_max_age(self) -> None:
        self.login()
        token = grant_sudo_privileges(self.request, 60)
        self.assertIsNotNone(token)
        self.assertRequestHasToken(self.request, 60)

    def test_without_user(self) -> None:
        delattr(self.request, "user")
        token = grant_sudo_privileges(self.request)
        self.assertIsNone(token)


class RevokeSudoPrivilegesTestCase(BaseTestCase):
    def assertRequestNotSudo(self, request: HttpRequest) -> None:
        sudo_request = cast("_SudoRequest", request)
        self.assertFalse(sudo_request._sudo)
        self.assertNotIn(COOKIE_NAME, self.request.session)

    def test_revoke_sudo_privileges_noop(self) -> None:
        revoke_sudo_privileges(self.request)
        self.assertRequestNotSudo(self.request)

    def test_revoke_sudo_privileges(self) -> None:
        self.login()
        grant_sudo_privileges(self.request)
        revoke_sudo_privileges(self.request)
        self.assertRequestNotSudo(self.request)


class HasSudoPrivilegesTestCase(BaseTestCase):
    def test_untouched(self) -> None:
        self.assertFalse(has_sudo_privileges(self.request))

    def test_granted(self) -> None:
        self.login()
        grant_sudo_privileges(self.request)
        self.assertTrue(has_sudo_privileges(self.request))

    def test_revoked(self) -> None:
        self.login()
        grant_sudo_privileges(self.request)
        revoke_sudo_privileges(self.request)
        self.assertFalse(has_sudo_privileges(self.request))

    def test_cookie_and_token_match(self) -> None:
        self.login()

        def get_signed_cookie(key: str, salt: str = "", max_age: int | None = None) -> str:
            return "abc123"

        self.request.session[COOKIE_NAME] = "abc123"
        setattr(self.request, "get_signed_cookie", get_signed_cookie)
        self.assertTrue(has_sudo_privileges(self.request))

    def test_cookie_and_token_mismatch(self) -> None:
        self.login()

        def get_signed_cookie(key: str, salt: str = "", max_age: int | None = None) -> str:
            return "nope"

        self.request.session[COOKIE_NAME] = "abc123"
        setattr(self.request, "get_signed_cookie", get_signed_cookie)
        self.assertFalse(has_sudo_privileges(self.request))

    def test_cookie_bad_signature(self) -> None:
        self.login()

        def get_signed_cookie(key: str, salt: str = "", max_age: int | None = None) -> str:
            raise BadSignature

        self.request.session[COOKIE_NAME] = "abc123"
        setattr(self.request, "get_signed_cookie", get_signed_cookie)
        self.assertFalse(has_sudo_privileges(self.request))

    def test_missing_keys(self) -> None:
        self.login()
        self.assertFalse(has_sudo_privileges(self.request))
