from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _
from cryptography.exceptions import InvalidSignature, InvalidKey
from time import time
from u2flib_server import u2f
from u2flib_server.model import DeviceRegistration

from sentry import options
from sentry.utils.dates import to_datetime
from sentry.utils.decorators import classproperty
from sentry.utils.http import absolute_uri

from .base import AuthenticatorInterface, ActivationChallengeResult


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

    def generate_new_config(self):
        return {}

    def start_enrollment(self):
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
        binding, cert = u2f.complete_registration(enrollment_data, response_data, self.u2f_facets)
        devices = self.config.setdefault("devices", [])
        devices.append(
            {"name": device_name or "Security Key", "ts": int(time()), "binding": dict(binding)}
        )

    def activate(self, request):
        challenge = dict(u2f.begin_authentication(self.u2f_app_id, self.get_u2f_devices()))
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

    def validate_response(self, request, challenge, response):
        try:
            u2f.complete_authentication(challenge, response, self.u2f_facets)
        except (InvalidSignature, InvalidKey, StopIteration):
            return False
        return True
