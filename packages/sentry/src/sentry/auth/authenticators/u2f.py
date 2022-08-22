from base64 import urlsafe_b64encode
from time import time
from urllib.parse import urlparse

from cryptography.exceptions import InvalidKey, InvalidSignature
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _
from fido2 import cbor
from fido2.client import ClientData
from fido2.ctap2 import AuthenticatorData, base
from fido2.server import Fido2Server, U2FFido2Server
from fido2.utils import websafe_decode
from fido2.webauthn import PublicKeyCredentialRpEntity
from rest_framework.request import Request
from u2flib_server.model import DeviceRegistration

from sentry import options
from sentry.auth.authenticators.base import EnrollmentStatus
from sentry.utils import json
from sentry.utils.dates import to_datetime
from sentry.utils.decorators import classproperty
from sentry.utils.http import absolute_uri

from .base import ActivationChallengeResult, AuthenticatorInterface


def decode_credential_id(device):
    return urlsafe_b64encode(device["binding"].credential_data.credential_id).decode("ascii")


def create_credential_object(registeredKey):
    return base.AttestedCredentialData.from_ctap1(
        websafe_decode(registeredKey["keyHandle"]),
        websafe_decode(registeredKey["publicKey"]),
    )


class U2fInterface(AuthenticatorInterface):
    type = 3
    interface_id = "u2f"
    configure_button = _("Configure")
    name = _("U2F (Universal 2nd Factor)")
    description = _(
        "Authenticate with a U2F hardware device. This is a "
        "device like a Yubikey or something similar which "
        "supports FIDO's U2F specification. This also requires "
        "a browser which supports this system (like Google "
        "Chrome)."
    )
    allow_multi_enrollment = True
    # rp is a relying party for webauthn, this would be sentry.io for SAAS
    # and the prefix for self-hosted / dev environments
    rp_id = urlparse(options.get("system.url-prefix")).hostname
    rp = PublicKeyCredentialRpEntity(rp_id, "Sentry")
    webauthn_registration_server = Fido2Server(rp)

    def __init__(self, authenticator=None, status=EnrollmentStatus.EXISTING):
        super().__init__(authenticator, status)

        self.webauthn_authentication_server = U2FFido2Server(
            app_id=self.u2f_app_id, rp={"id": self.rp_id, "name": "Sentry"}
        )

    @classproperty
    def u2f_app_id(cls):
        rv = options.get("u2f.app-id")
        return rv or absolute_uri(reverse("sentry-u2f-app-id"))

    @classproperty
    def u2f_facets(cls):
        facets = options.get("u2f.facets")
        if not facets:
            return [options.get("system.url-prefix")]
        return [x.rstrip("/") for x in facets]

    @classproperty
    def is_available(cls):
        url_prefix = options.get("system.url-prefix")
        return url_prefix and url_prefix.startswith("https://")

    def _get_kept_devices(self, key):
        def _key_does_not_match(device):
            if type(device["binding"]) == AuthenticatorData:
                return decode_credential_id(device) != key
            else:
                return device["binding"]["keyHandle"] != key

        return [device for device in self.config.get("devices", ()) if _key_does_not_match(device)]

    def generate_new_config(self):
        return {}

    def start_enrollment(self, user):
        credentials = self.credentials()
        registration_data, state = self.webauthn_registration_server.register_begin(
            user={
                "id": user.id.to_bytes(64, byteorder="big"),
                "name": user.username,
                "displayName": user.username,
            },
            credentials=credentials,
            # user_verification is where the authenticator verifies that the user is authorized
            # to use the authenticator, this isn't needed for our usecase so set a discouraged
            user_verification="discouraged",
        )
        return cbor.encode(registration_data), state

    def get_u2f_devices(self):
        rv = []
        for data in self.config.get("devices", ()):
            # XXX: The previous version of python-u2flib-server didn't store
            # the `version` in the device binding. Defaulting to `U2F_V2` here
            # so that we don't break existing u2f registrations.
            if type(data["binding"]) == AuthenticatorData:
                rv.append(data["binding"])
            else:
                data["binding"].setdefault("version", "U2F_V2")
                rv.append(DeviceRegistration(data["binding"]))
        return rv

    def credentials(self):
        credentials = []
        # there are 2 types of registered keys from the registered devices, those with type
        # AuthenticatorData are those from WebAuthn registered devices that we don't have to modify
        # the other is those registered with u2f-api and it a dict with the keys keyHandle and publicKey
        for device in self.get_u2f_devices():
            if type(device) == AuthenticatorData:
                credentials.append(device.credential_data)
            else:
                credentials.append(create_credential_object(device))
        return credentials

    def remove_u2f_device(self, key):
        """Removes a U2F device but never removes the last one.  This returns
        False if the last device would be removed.
        """
        devices = self._get_kept_devices(key)

        if devices:
            self.config["devices"] = devices
            return True
        return False

    def get_device_name(self, key):
        for device in self.config.get("devices", ()):
            if type(device["binding"]) == AuthenticatorData:
                if decode_credential_id(device) == key:
                    return device["name"]
            elif device["binding"]["keyHandle"] == key:
                return device["name"]

    def get_registered_devices(self):
        rv = []
        for device in self.config.get("devices", ()):
            if type(device["binding"]) == AuthenticatorData:
                rv.append(
                    {
                        "timestamp": to_datetime(device["ts"]),
                        "name": device["name"],
                        "key_handle": decode_credential_id(device),
                        "app_id": self.rp_id,
                    }
                )
            else:
                rv.append(
                    {
                        "timestamp": to_datetime(device["ts"]),
                        "name": device["name"],
                        "key_handle": device["binding"]["keyHandle"],
                        "app_id": device["binding"]["appId"],
                    }
                )
        rv.sort(key=lambda x: x["name"])
        return rv

    def try_enroll(self, enrollment_data, response_data, device_name=None, state=None):
        data = json.loads(response_data)
        client_data = ClientData(websafe_decode(data["response"]["clientDataJSON"]))
        att_obj = base.AttestationObject(websafe_decode(data["response"]["attestationObject"]))
        binding = self.webauthn_registration_server.register_complete(state, client_data, att_obj)
        devices = self.config.setdefault("devices", [])
        devices.append(
            {"name": device_name or "Security Key", "ts": int(time()), "binding": binding}
        )

    def activate(self, request: Request):
        credentials = self.credentials()
        challenge, state = self.webauthn_authentication_server.authenticate_begin(
            credentials=credentials
        )
        request.session["webauthn_authentication_state"] = state

        return ActivationChallengeResult(challenge=cbor.encode(challenge["publicKey"]))

    def validate_response(self, request: Request, challenge, response):
        try:
            credentials = self.credentials()
            self.webauthn_authentication_server.authenticate_complete(
                state=request.session["webauthn_authentication_state"],
                credentials=credentials,
                credential_id=websafe_decode(response["keyHandle"]),
                client_data=ClientData(websafe_decode(response["clientData"])),
                auth_data=AuthenticatorData(websafe_decode(response["authenticatorData"])),
                signature=websafe_decode(response["signatureData"]),
            )
        except (InvalidSignature, InvalidKey, StopIteration):
            return False
        return True
