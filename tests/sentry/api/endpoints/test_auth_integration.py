from dataclasses import dataclass
from hashlib import sha256
from typing import Any, TypedDict

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from django.urls import reverse
from fido2.cose import ES256
from fido2.ctap2 import AuthenticatorData
from fido2.ctap2.base import AttestedCredentialData
from fido2.utils import websafe_encode
from rest_framework.response import Response

from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@dataclass(frozen=True)
class WebAuthnTestCredential:
    interface: U2fInterface
    private_key: ec.EllipticCurvePrivateKey
    credential_id: bytes


class WebAuthnResponse(TypedDict):
    keyHandle: str
    clientData: str
    authenticatorData: str
    signatureData: str


@control_silo_test
class ApiAuthIntegrationTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user.set_password("password")
        self.user.save()
        self.client.get(reverse("sentry-api-0-auth-config"))

    def assert_logged_in(self) -> None:
        response = self.client.get(reverse("sentry-api-0-auth"))

        assert response.status_code == 200
        assert response.data["id"] == str(self.user.id)

    def assert_logged_out(self) -> None:
        response = self.client.get(reverse("sentry-api-0-auth"))

        assert response.status_code == 400

    def login(self, password: str = "password") -> Response:
        return self.client.post(
            reverse("sentry-api-0-auth-login"),
            data={"username": self.user.username, "password": password},
        )

    def verify_2fa(self, method: str, **data: Any) -> Response:
        return self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": method, **data},
            content_type="application/json",
        )

    def activate_2fa(self, method: str) -> Response:
        return self.client.post(reverse("sentry-api-0-auth-2fa-challenge"), data={"method": method})

    def enroll_webauthn(self) -> WebAuthnTestCredential:
        private_key = ec.generate_private_key(ec.SECP256R1())
        credential_id = b"integration-test-credential"
        interface = U2fInterface()
        assert interface.rp_id is not None

        credential = AttestedCredentialData.create(
            b"\0" * 16,
            credential_id,
            ES256.from_cryptography_key(private_key.public_key()),
        )
        registration_data = AuthenticatorData.create(
            sha256(interface.rp_id.encode()).digest(),
            AuthenticatorData.FLAG.USER_PRESENT | AuthenticatorData.FLAG.ATTESTED,
            0,
            credential,
        )
        interface.config["devices"] = [
            {"name": "Integration test key", "ts": 0, "binding": registration_data}
        ]
        interface.enroll(self.user)

        return WebAuthnTestCredential(interface, private_key, credential_id)

    def sign_webauthn_challenge(self, credential: WebAuthnTestCredential) -> WebAuthnResponse:
        rp_id = credential.interface.rp_id
        assert rp_id is not None

        challenge = self.client.session["webauthn_authentication_state"]["challenge"]
        client_data = json.dumps(
            {
                "type": "webauthn.get",
                "challenge": challenge,
                "origin": f"https://{rp_id}",
            }
        ).encode()
        authenticator_data = AuthenticatorData.create(
            sha256(rp_id.encode()).digest(),
            AuthenticatorData.FLAG.USER_PRESENT,
            1,
        )
        signature = credential.private_key.sign(
            authenticator_data + sha256(client_data).digest(), ec.ECDSA(hashes.SHA256())
        )

        return {
            "keyHandle": websafe_encode(credential.credential_id),
            "clientData": websafe_encode(client_data),
            "authenticatorData": websafe_encode(authenticator_data),
            "signatureData": websafe_encode(signature),
        }

    def test_login_without_2fa(self) -> None:
        response = self.login()

        assert response.status_code == 200
        self.assert_logged_in()

    def test_login_with_invalid_credentials(self) -> None:
        response = self.login(password="invalid")

        assert response.status_code == 400
        self.assert_logged_out()

    def test_login_with_totp(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)

        login_response = self.login()
        verification_response = self.verify_2fa("totp", otp=interface.make_otp().generate_otp())

        assert login_response.status_code == 202
        assert login_response.data["mfaMethods"] == [{"id": "totp"}]
        assert verification_response.status_code == 200
        self.assert_logged_in()

    def test_login_with_totp_and_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        organization = self.create_organization(owner=self.user, slug="org-b")
        interface = TotpInterface()
        interface.enroll(self.user)

        login_response = self.client.post(
            reverse("sentry-api-0-auth-login"),
            data={
                "username": self.user.username,
                "password": "password",
                "orgSlug": organization.slug,
            },
        )

        assert login_response.status_code == 202
        assert self.client.session["_pending_2fa"][2] is None

        verification_response = self.verify_2fa("totp", otp=interface.make_otp().generate_otp())

        assert verification_response.status_code == 200
        assert verification_response.data["nextUri"] == (
            f"/organizations/{organization.slug}/issues/"
        )
        assert self.client.session["activeorg"] == organization.slug

    @override_options({"system.url-prefix": "https://testserver"})
    def test_login_with_webauthn(self) -> None:
        credential = self.enroll_webauthn()

        login_response = self.login()
        challenge_response = self.activate_2fa("u2f")
        verification_response = self.verify_2fa(
            "u2f", response=self.sign_webauthn_challenge(credential)
        )

        assert login_response.status_code == 202
        assert login_response.data["mfaMethods"] == [{"id": "u2f"}]
        assert challenge_response.status_code == 200, challenge_response.data
        assert verification_response.status_code == 200
        self.assert_logged_in()
