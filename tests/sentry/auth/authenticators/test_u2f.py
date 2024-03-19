from datetime import datetime, timedelta
from unittest.mock import Mock

from fido2 import cbor
from fido2.ctap2 import AuthenticatorData
from fido2.server import Fido2Server
from fido2.webauthn import PublicKeyCredentialRpEntity
from pytest import raises

from sentry.auth.authenticators.base import ActivationChallengeResult
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test


@control_silo_test
class U2FInterfaceTest(TestCase):
    CURRENT_TIME = datetime(2024, 3, 11, 0, 0)
    VALID_TIMESTAMP = (CURRENT_TIME + timedelta(minutes=1)).timestamp()
    INVALID_EXPIRED_TIMESTAMP = (CURRENT_TIME - timedelta(minutes=3)).timestamp()
    INVALID_FUTURE_TIMESTAMP = (CURRENT_TIME + timedelta(minutes=3)).timestamp()

    def setUp(self):
        self.u2f = U2fInterface()
        self.login_as(user=self.user)
        rp = PublicKeyCredentialRpEntity("richardmasentry.ngrok.io", "Sentry")
        self.test_registration_server = Fido2Server(rp, verify_origin=lambda origin: True)
        self.response = {
            "keyHandle": "F5MKBNqJMnHX-g0jee03d0slMyvz0FMWAf1YzF9mjZhA6ePDEwt8QT2zNR-ungcffGGxpGtp4yXRC5gz8t1Lww",
            "clientData": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiRjJYS0tyZ19FY1h6OEljUjBUX3BzcUJqenc5X1VIYTFIU2premtFbTUzQSIsIm9yaWdpbiI6Imh0dHBzOi8vc2VudHJ5LmlvIiwiY3Jvc3NPcmlnaW4iOmZhbHNlLCJvdGhlcl9rZXlzX2Nhbl9iZV9hZGRlZF9oZXJlIjoiZG8gbm90IGNvbXBhcmUgY2xpZW50RGF0YUpTT04gYWdhaW5zdCBhIHRlbXBsYXRlLiBTZWUgaHR0cHM6Ly9nb28uZ2wveWFiUGV4In0",
            "signatureData": "MEUCIDe2DPI7E3tWa31JN_FG5m9rhc2v2lDRsWY-Yy7jgdT0AiEA5hkw8UGEfu-d_H5CEHuGC1Cj1wvFPqiRu-c_q50R6NM",
            "authenticatorData": "ss7JfEqyMJeXvxXeO3AXn9tPTh1R4bNVGkMcr6WH-08BAAAD_A",
        }
        self.request = self.make_request(user=self.user)

    def test_start_enrollment_webauthn(self):
        self.u2f.webauthn_registration_server = self.test_registration_server
        encoded_challenge, state = self.u2f.start_enrollment(self.user)

        challenge = cbor.decode(encoded_challenge)
        assert len(state) == 2
        assert state["user_verification"] == "discouraged"
        assert len(state["challenge"]) == 43

        assert challenge["publicKey"]["rp"] == {"id": "richardmasentry.ngrok.io", "name": "Sentry"}
        assert challenge["publicKey"]["user"] == {
            "id": self.user.id.to_bytes(64, byteorder="big"),
            "name": self.user.username,
            "displayName": self.user.username,
        }
        assert int.from_bytes(challenge["publicKey"]["user"]["id"], byteorder="big") == self.user.id
        assert len(challenge["publicKey"]["pubKeyCredParams"]) == 4

    def test_try_enroll_webauthn(self):
        self.u2f.webauthn_registration_server = self.test_registration_server
        state = {
            "challenge": "FmKqEKsXOinMhOdNhcZbMCbGleTlDeFr0S1gSYGzPY0",
            "user_verification": "discouraged",
        }
        data = '{"id":"TYJVkw5RJGuwyY-veny4wBvPnhIc1-2vs7a17W6fRPMevfDlTR_YWTnLwgeLjKvNaZgMDd2T75CD9bEUX3FyxQ","rawId":"TYJVkw5RJGuwyY-veny4wBvPnhIc1-2vs7a17W6fRPMevfDlTR_YWTnLwgeLjKvNaZgMDd2T75CD9bEUX3FyxQ","response":{"attestationObject":"o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjEdMsc6ARz46ITf5wcoxCGiLKiJRlmv2GeNJ635pkBOmVBAAAA_wAAAAAAAAAAAAAAAAAAAAAAQE2CVZMOUSRrsMmPr3p8uMAbz54SHNftr7O2te1un0TzHr3w5U0f2Fk5y8IHi4yrzWmYDA3dk--Qg_WxFF9xcsWlAQIDJiABIVggo6MzqMkVN1UI6d4gf60CoBH4CnAKURH0Q8ENYnD2k6MiWCCvFWvPJs_p0zGVyBwoZDy7WyQZUAPVZhmCAzXUnapQ-A","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiRm1LcUVLc1hPaW5NaE9kTmhjWmJNQ2JHbGVUbERlRnIwUzFnU1lHelBZMCIsIm9yaWdpbiI6Imh0dHBzOi8vcmljaGFyZG1hc2VudHJ5Lm5ncm9rLmlvIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ"},"type":""}'

        assert len(self.u2f.config.setdefault("devices", [])) == 0

        self.u2f.try_enroll("enrollment_data", data, state=state)

        assert len(self.u2f.config.setdefault("devices", [])) == 1

        device = self.u2f.config.setdefault("devices", [])[0]
        assert device["name"] is not None
        assert device["ts"] is not None
        assert type(device["binding"]) is AuthenticatorData

    def test_activate_webauthn(self):
        self.test_try_enroll_webauthn()

        result = self.u2f.activate(self.request)

        assert isinstance(result, ActivationChallengeResult)
        assert len(self.request.session["webauthn_authentication_state"][0]["challenge"]) == 43
        assert self.request.session["webauthn_authentication_state"][0]["user_verification"] is None

    @freeze_time(CURRENT_TIME)
    def test_activate_staff_webauthn_valid_timestamp(self):
        self.test_try_enroll_webauthn()

        self.request.session["staff_auth_flow"] = self.VALID_TIMESTAMP

        result = self.u2f.activate(self.request)

        assert isinstance(result, ActivationChallengeResult)
        assert "webauthn_authentication_state" not in self.request.session
        assert (
            len(self.request.session["staff_webauthn_authentication_state"][0]["challenge"]) == 43
        )
        assert (
            self.request.session["staff_webauthn_authentication_state"][0]["user_verification"]
            is None
        )

    @freeze_time(CURRENT_TIME)
    def test_activate_staff_webauthn_invalid_timestamp(self):
        self.test_try_enroll_webauthn()

        self.request.session["staff_auth_flow"] = self.INVALID_EXPIRED_TIMESTAMP

        result = self.u2f.activate(self.request)

        assert isinstance(result, ActivationChallengeResult)
        assert "webauthn_authentication_state" not in self.request.session
        assert (
            len(self.request.session["staff_webauthn_authentication_state"][0]["challenge"]) == 43
        )
        assert (
            self.request.session["staff_webauthn_authentication_state"][0]["user_verification"]
            is None
        )

    def test_validate_response_normal_state(self):
        self.test_try_enroll_webauthn()
        mock_state = Mock()
        self.u2f.webauthn_authentication_server.authenticate_complete = mock_state

        self.request.session["webauthn_authentication_state"] = ("normal state", 5)

        assert self.u2f.validate_response(self.request, None, self.response)
        _, kwargs = mock_state.call_args
        assert kwargs.get("state") == "normal state"

    @freeze_time(CURRENT_TIME)
    def test_validate_response_staff_state_valid_timestamp(self):
        self.test_try_enroll_webauthn()
        mock_state = Mock()
        self.u2f.webauthn_authentication_server.authenticate_complete = mock_state

        self.request.session["staff_webauthn_authentication_state"] = ("staff state", 5)
        self.request.session["staff_auth_flow"] = self.VALID_TIMESTAMP

        assert self.u2f.validate_response(self.request, None, self.response)
        _, kwargs = mock_state.call_args
        assert kwargs.get("state") == "staff state"

    @freeze_time(CURRENT_TIME)
    def test_validate_response_staff_state_invalid_timestamp(self):
        self.test_try_enroll_webauthn()
        mock_state = Mock()
        self.u2f.webauthn_authentication_server.authenticate_complete = mock_state

        # Test expired timestamp
        self.request.session["webauthn_authentication_state"] = ("non-staff state", 5)
        self.request.session["staff_auth_flow"] = self.INVALID_EXPIRED_TIMESTAMP

        assert self.u2f.validate_response(self.request, None, self.response)
        _, kwargs = mock_state.call_args
        assert kwargs.get("state") == "non-staff state"

        # Test timestamp too far in the future
        self.request.session["webauthn_authentication_state"] = ("non-staff state", 5)
        self.request.session["staff_auth_flow"] = self.INVALID_FUTURE_TIMESTAMP
        assert self.u2f.validate_response(self.request, None, self.response)
        _, kwargs = mock_state.call_args
        assert kwargs.get("state") == "non-staff state"

    @freeze_time(CURRENT_TIME)
    def test_validate_response_failing_still_clears_all_states(self):
        self.test_try_enroll_webauthn()
        mock_state = Mock(side_effect=ValueError("test"))
        self.u2f.webauthn_authentication_server.authenticate_complete = mock_state

        self.request.session["webauthn_authentication_state"] = ("non-staff state", 5)
        self.request.session["staff_webauthn_authentication_state"] = ("staff state", 5)
        self.request.session["staff_auth_flow"] = self.VALID_TIMESTAMP

        with raises(ValueError):
            self.u2f.validate_response(self.request, None, self.response)
        _, kwargs = mock_state.call_args
        assert kwargs.get("state") == "staff state"
