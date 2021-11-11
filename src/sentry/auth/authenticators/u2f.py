from time import time

from cryptography.exceptions import InvalidKey, InvalidSignature
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _
from fido2 import cbor
from fido2.client import ClientData
from fido2.ctap2 import AuthenticatorData, base
from fido2.server import Fido2Server, U2FFido2Server
from fido2.utils import websafe_decode
from fido2.webauthn import PublicKeyCredentialRpEntity
from u2flib_server import u2f
from u2flib_server.model import DeviceRegistration

from sentry import features, options
from sentry.utils.dates import to_datetime
from sentry.utils.decorators import classproperty
from sentry.utils.http import absolute_uri

from .base import ActivationChallengeResult, AuthenticatorInterface


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

    def _create_credential_object(self, registeredKey):
        return base.AttestedCredentialData.from_ctap1(
            websafe_decode(registeredKey["keyHandle"]),
            websafe_decode(registeredKey["publicKey"]),
        )

    def generate_new_config(self):
        return {}

    def start_enrollment(self, user, is_webauthn_register_ff):
        if is_webauthn_register_ff:
            # u2f_app_id needs to be changed to return sentry.io or dev name
            rp = PublicKeyCredentialRpEntity("richardmasentry.ngrok.io", "Sentry")
            server = Fido2Server(rp)
            credentials = []
            for registeredKey in self.get_u2f_devices():
                c = self._create_credential_object(registeredKey)
                credentials.append(c)

            registration_data, state = server.register_begin(
                user={"id": bytes(user.id), "name": user.username, "displayName": user.name},
                credentials=credentials,
                user_verification="discouraged",
                # authenticator_attachment="cross-platform",
            )
            return cbor.encode(registration_data)

        return u2f.begin_registration(self.u2f_app_id, self.get_u2f_devices()).data_for_client

    def get_u2f_devices(self):
        rv = []
        for data in self.config.get("devices") or ():
            # XXX: The previous version of python-u2flib-server didn't store
            # the `version` in the device binding. Defaulting to `U2F_V2` here
            # so that we don't break existing u2f registrations.
            data["binding"].setdefault("version", "U2F_V2")
            rv.append(DeviceRegistration(data["binding"]))
        return rv

    def remove_u2f_device(self, key):
        """Removes a U2F device but never removes the last one.  This returns
        False if the last device would be removed.
        """
        devices = [x for x in self.config.get("devices") or () if x["binding"]["keyHandle"] != key]
        if devices:
            self.config["devices"] = devices
            return True
        return False

    def get_device_name(self, key):
        for device in self.config.get("devices") or ():
            if device["binding"]["keyHandle"] == key:
                return device["name"]

    def get_registered_devices(self):
        rv = []
        for device in self.config.get("devices") or ():
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

    def try_enroll(self, enrollment_data, response_data, device_name=None):
        # breakpoint()
        binding, cert = u2f.complete_registration(enrollment_data, response_data, self.u2f_facets)
        devices = self.config.setdefault("devices", [])
        devices.append(
            {"name": device_name or "Security Key", "ts": int(time()), "binding": dict(binding)}
        )

    def activate(self, request):
        challenge = dict(u2f.begin_authentication(self.u2f_app_id, self.get_u2f_devices()))

        # TODO for completeness change to webauthn when functionalities for everything else is done
        # server = U2FFido2Server(
        #     app_id=self.u2f_app_id, rp={"id": self.u2f_app_id, "name": "Example RP"}
        # )
        # # credentials = []
        # # for device in self.get_u2f_devices():
        # #     credentials.append(
        # #         {
        # #             "credential_id": device["keyHandle"],
        # #             "publicKey": device["publicKey"],
        # #         }
        # #     )
        # challenge = server.authenticate_begin()

        # XXX: Upgrading python-u2flib-server to 5.0.0 changes the response
        # format. Our current js u2f library expects the old format, so
        # massaging the data to include the old `authenticateRequests` key here.

        authenticate_requests = []
        for registered_key in challenge["registeredKeys"]:
            authenticate_requests.append(
                {
                    "challenge": challenge["challenge"],
                    "version": registered_key["version"],
                    "keyHandle": registered_key["keyHandle"],
                    "appId": registered_key["appId"],
                }
            )
        challenge["authenticateRequests"] = authenticate_requests

        return ActivationChallengeResult(challenge=challenge)

    def validate_response(self, request, challenge, response, is_webauthn_signin_ff_enabled):
        try:
            if is_webauthn_signin_ff_enabled:
                # TODO change rp.id later when register is implemented
                server = U2FFido2Server(
                    app_id=challenge["appId"],
                    rp={"id": challenge["appId"], "name": "Relying Party"},
                )
                state = {
                    "challenge": challenge["challenge"],
                    "user_verification": None,
                }
                credentials = []
                for registeredKey in challenge["registeredKeys"]:
                    c = self._create_credential_object(registeredKey)
                    credentials.append(c)
                server.authenticate_complete(
                    state=state,
                    credentials=credentials,
                    credential_id=websafe_decode(response["keyHandle"]),
                    client_data=ClientData(websafe_decode(response["clientData"])),
                    auth_data=AuthenticatorData(websafe_decode(response["authenticatorData"])),
                    signature=websafe_decode(response["signatureData"]),
                )
                return True
            u2f.complete_authentication(challenge, response, self.u2f_facets)
        except (InvalidSignature, InvalidKey, StopIteration):
            return False
        return True
