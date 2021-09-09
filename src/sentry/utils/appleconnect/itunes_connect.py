"""
Contains functionality ported from fastlane-starship for getting app store connect information
using the old (itunes) api
"""

import dataclasses
import enum
import http
import logging
from collections import namedtuple
from http import HTTPStatus
from typing import List, NewType, Optional

import requests
import sentry_sdk

from sentry.utils import json

logger = logging.getLogger(__name__)


SESSION_COOKIE_NAME = "myacinfo"


ITunesServiceKey = NewType("ITunesServiceKey", str)


TrustedPhoneInfo = namedtuple("TrustedPhoneInfo", ["id", "push_mode"])

REQUEST_TIMEOUT = 15.0


class ITunesError(Exception):
    """Generic error communicating with iTunes."""

    pass


class InvalidUsernamePasswordError(ITunesError):
    """Invalid username or password."""

    pass


class InvalidAuthCodeError(ITunesError):
    """An invalid authentication code was provided."""

    pass


class SessionExpiredError(ITunesError):
    """The iTunes session has expired."""

    pass


class ForbiddenError(ITunesError):
    """The iTunes session does not have access to the requested dSYM.

    Most likely because the session has been switched to the wrong organisation by someone,
    probably due to credentials reuse.
    """

    pass


class SmsBlockedError(ITunesError):
    """Blocked from requesting more SMS codes for some period of time."""

    pass


PublicProviderId = NewType("PublicProviderId", str)


@dataclasses.dataclass(frozen=True)
class ITunesProvider:
    """A iTunes provider aka organisation."""

    providerId: int
    publicProviderId: PublicProviderId
    name: str
    contentTypes: List[str]
    subType: str


@enum.unique
class ClientState(enum.Enum):
    NEW = "NEW"
    AUTH_REQUESTED = "AUTH_REQUESTED"
    SMS_AUTH_REQUESTED = "SMS_AUTH_REQUESTED"
    AUTHENTICATED = "AUTHENTICATED"
    EXPIRED = "EXPIRED"


class ITunesClient:
    """Stateful client to talk to iTunes.

    This client allows you to log into iTunes using two-factor authentication and retrieve a
    URL to download dSYMs from.  It is stateful so that you can only go through the
    operations correctly:

    1. :meth:`start_login_sequence`
    2a. :meth:`two_factor_code`
    2b.1. :meth:`request_sms_auth`
    2b.2. :meth:`sms_code`
    3. (optional) :meth:`set_provider`

    TODO: This could possibly be simplified to unify :meth:`sms_code` with
       :meth:`two_factor_code`.  This would need testing if you are still allowed to submit
       the 2FA if SMS was requested or not, if not this can be further simplified and more
       state can be in the client, specifically the AppStoreConnect2FactorAuthEndpoint would
       no longer need to provide `useSms`.

    Once the state is :attr:`ClientState.AUTHENTICATED` you can use the client:

    - :meth:`request_session_info` (also validates session is still alive)
    - :meth:`request_available_providers`
    - :meth:`get_dsym_url`

    There are two ways to export the client state and re-create a new client:

    - For an authenticated client: :meth:`session_cookie` and :meth:`from_session_cookie`.
    - For the client during any stage of authentication: :meth:`to_json` and
      :meth:`from_json`.

    :param service_key: Optionally you can create a client with a known service key.  This
       key is the same long term for the service and providing it can save an extra request
       to the server.
    """

    SESSION_COOKIE_NAME = "myacinfo"

    def __init__(self, service_key: Optional[ITunesServiceKey] = None):
        self.session = requests.Session()
        if service_key is None:
            service_key = self.request_auth_service_key()
        self.service_key = service_key
        self.state = ClientState.NEW

        # The x-apple-id-session-id header as populated by :meth:`start_login_sequence`.
        self._session_id: Optional[str] = None

        # The scnt header as populated by :meth:`start_login_sequence`.
        self._scnt: Optional[str] = None

    @property
    def session_id(self) -> str:
        """The session ID, if client already has one (after :meth:start_login_sequence).

        :raises AttributeError: if this state does not yet exist.
        """
        if self._session_id is None:
            raise AttributeError("No session_id available yet")
        else:
            return self._session_id

    @property
    def scnt(self) -> str:
        """The scnt header, if the client already has one (after :meth:start_login_sequence).

        :raises AttributeError: if this state does not yet exist.
        """
        if self._scnt is None:
            raise AttributeError("No scnt header available yet")
        else:
            return self._scnt

    @classmethod
    def from_session_cookie(
        cls, cookie: str, service_key: Optional[ITunesServiceKey] = None
    ) -> "ITunesClient":
        """Creates a client from an existing session cookie.

        :raises SessionExpiredError: if the session cookie is no longer valid.
        """
        client = cls(service_key)
        client.load_session_cookie(cookie)
        if client.state is not ClientState.AUTHENTICATED:
            raise SessionExpiredError
        return client

    def to_json(self) -> json.JSONData:
        """Return an JSON object that can be used to re-create this class.

        This allows to serialise the state of this instance to a JSON object which can be
        used to recreate the instance using :meth:`from_json_session_context`.
        """
        context = {"state": self.state.value, "service_key": self.service_key}
        if self.session_id is not None:
            context["session_id"] = self.session_id
        if self._scnt is not None:
            context["scnt"] = self.scnt
        if self.state is ClientState.AUTHENTICATED:
            context["session_cookie"] = self.session_cookie()
        return context

    @classmethod
    def from_json(cls, context: json.JSONData) -> "ITunesClient":
        """Creates a client from the JSON object created by :meth:`to_json`.

        This will restore the internal state of the client, allowing the client to be
        reconstructed from a previous state.

        NOTE: This object can come from data which could be manipulated, be careful to not
        trust this object too much.

        :raises: some exception if the JSON object does not contain the correct state.
        """
        obj = cls(service_key=context["service_key"])
        obj.state = ClientState(context["state"])
        if obj.state in [
            ClientState.AUTH_REQUESTED,
            ClientState.SMS_AUTH_REQUESTED,
        ]:
            obj._session_id = context["session_id"]
            obj._scnt = context["scnt"]
        if obj.state in [ClientState.AUTHENTICATED, ClientState.EXPIRED]:
            obj.load_session_cookie(context["session_cookie"])
        return obj

    def request_auth_service_key(self) -> ITunesServiceKey:
        """Obtains the authentication service key used in X-Apple-Widget-Key header.

        This key is pretty static and can be cached long-term, saving a request to fetch it.
        It can optionally be provided to :meth:`init`.

        :returns: the service key to be used in all future calls X-Apple-Widget-Key headers.

        :raises: any exception in case of failure.
        """
        url = "https://appstoreconnect.apple.com/olympus/v1/app/config?hostname=itunesconnect.apple.com"
        logger.debug("GET %s", url)
        response = self.session.get(url, timeout=REQUEST_TIMEOUT)
        data = response.json()
        return ITunesServiceKey(data["authServiceKey"])

    def start_login_sequence(self, username: str, password: str) -> None:
        """Starts the login process.

        This will trigger the two factor authentication code to show on any validated device
        for the user.  The code must be provided using :meth:`auth_code`.

        Alternatively after calling this you can switch to SMS two factor authentication by
        calling :meth:`request_sms`.
        """
        assert self.state in [
            ClientState.NEW,
            ClientState.EXPIRED,
        ], f"Actual client state: {self.state}"
        url = "https://idmsa.apple.com/appleauth/auth/signin"
        logger.debug("POST %s", url)

        start_login = self.session.post(
            url,
            json={
                "accountName": username,
                "password": password,
                "rememberMe": True,
            },
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "X-Apple-Widget-Key": self.service_key,
                "Accept": "application/json, text/javascript",
            },
            timeout=REQUEST_TIMEOUT,
        )

        if start_login.status_code == http.HTTPStatus.OK:
            raise ITunesError(
                f"Two factor auth not enabled for user, status_code={start_login.status_code}"
            )
        elif start_login.status_code == http.HTTPStatus.CONFLICT:
            self._session_id = start_login.headers["x-apple-id-session-id"]
            self._scnt = start_login.headers["scnt"]
            self.state = ClientState.AUTH_REQUESTED
        elif start_login.status_code == http.HTTPStatus.UNAUTHORIZED:
            raise InvalidUsernamePasswordError
        else:
            raise ITunesError(f"Unexpected status code form sign in: {start_login.status_code}")

    def two_factor_code(self, code: str) -> None:
        """Sends the two-factor authentication code, completing authentication.

        :raises: :class:`InvalidTwoFactorAuthError`
        """
        assert self.state is ClientState.AUTH_REQUESTED, f"Actual client state: {self.state}"
        url = "https://idmsa.apple.com/appleauth/auth/verify/trusteddevice/securitycode"
        logger.debug("POST %s", url)
        response = self.session.post(
            url,
            json={
                "securityCode": {
                    "code": code,
                }
            },
            headers={
                "scnt": self.scnt,
                "X-Apple-Id-Session-Id": self.session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
            timeout=REQUEST_TIMEOUT,
        )
        if not response.ok:
            # TODO: Make invalid code distinguishable from generic error.
            raise InvalidAuthCodeError
        else:
            self.state = ClientState.AUTHENTICATED

    def _request_trusted_phone_info(self) -> TrustedPhoneInfo:
        """Requests the trusted phone info for the account."""
        url = "https://idmsa.apple.com/appleauth/auth"
        logger.debug("GET %s", url)
        response = self.session.get(
            url,
            headers={
                "scnt": self.scnt,
                "X-Apple-Id-Session-Id": self.session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code == HTTPStatus.LOCKED:
            raise SmsBlockedError
        if not response.ok:
            raise ITunesError(f"Unexpected response status: {response.status_code}")

        try:
            info = response.json()["trustedPhoneNumber"]
        except ValueError:
            raise ITunesError(
                f"Received unexpected response content, response status: {response.status_code}"
            )
        except KeyError:
            raise ITunesError(
                f"Trusted phone info missing from response with status: {response.status_code}"
            )
        return TrustedPhoneInfo(
            id=info["id"],
            push_mode=info["pushMode"],
        )

    def request_sms_auth(self) -> None:
        """Requests sending the authentication code to a trusted phone.

        :raises SmsBlockedError: if too many requests for the SMS auth code were made.
        :raises ITunesError: if there was an error requesting to use the trusted phone.
        """

        assert self.state in [
            ClientState.AUTH_REQUESTED,
            ClientState.SMS_AUTH_REQUESTED,
        ], f"Actual client state: {self.state}"
        trusted_phone = self._request_trusted_phone_info()
        url = "https://idmsa.apple.com/appleauth/auth/verify/phone"
        logger.debug("PUT %s", url)
        response = self.session.put(
            url,
            json={
                "phoneNumber": {"id": trusted_phone.id},
                "mode": trusted_phone.push_mode,
            },
            headers={
                "scnt": self.scnt,
                "X-Apple-Id-Session-Id": self.session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
                "Content-Type": "application/json",
            },
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code == HTTPStatus.LOCKED:
            raise SmsBlockedError
        if response.status_code != HTTPStatus.OK:
            raise ITunesError(f"Unexpected response status: {response.status_code}")
        self.state = ClientState.SMS_AUTH_REQUESTED

    def sms_code(self, code: str) -> None:
        """Sends the SMS auth code, completing authentication.

        :raises InvalidSmsAuthError:
        """
        assert self.state is ClientState.SMS_AUTH_REQUESTED, f"Actual client state: {self.state}"
        url = "https://idmsa.apple.com/appleauth/auth/verify/phone/securitycode"
        logger.debug("PUT %s", url)
        trusted_phone = self._request_trusted_phone_info()
        response = self.session.post(
            url,
            json={
                "securityCode": {"code": code},
                "phoneNumber": {"id": trusted_phone.id},
                "mode": trusted_phone.push_mode,
            },
            headers={
                "scnt": self.scnt,
                "X-Apple-Id-Session-Id": self.session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code != HTTPStatus.OK:
            # TODO: Make invalid code distinguishable from generic error.
            raise InvalidAuthCodeError
        else:
            self.state = ClientState.AUTHENTICATED

        # If we want more info about the failure extract failure info from the response body
        # response is a JSON with the following interesting fields:
        # (Extracted from a login attempt with wrong code)
        # 'restrictedAccount': False,
        # 'securityCode': {'code': '123123',
        #                  'securityCodeCooldown': False,
        #                  'securityCodeLocked': False,
        #                  'tooManyCodesSent': False,
        #                  'tooManyCodesValidated': False},
        # 'serviceErrors': [{'code': '-21669',
        #                    'message': 'Incorrect verification code.',
        #                    'suppressDismissal': False,
        #                    'title': 'Incorrect Verification Code'}],

    def session_cookie(self) -> str:
        """Extracts the session cookies.

        This can be used to create a new client without having to re-authenticate, if the
        session is still valid.

        :returns: the session cookie.
        :raises: an exception if the client is not yet authenticated and has no session
           cookie.
        """
        assert self.state is ClientState.AUTHENTICATED, f"Actual client state: {self.state}"
        return self.session.cookies.get(SESSION_COOKIE_NAME)  # type: ignore

    def load_session_cookie(self, cookie: str) -> None:
        """Loads the itunes session cookie in the client's session.

        This will invalidate the client's authentication state and reset it.  It will
        trigger a request to check a cookie is valid and use this to set the state
        correctly.

        If the iTunes session is still valid the user will be logged in inside the session.
        """
        self.session.cookies.set(self.SESSION_COOKIE_NAME, cookie)  # type: ignore
        try:
            self._request_session_info()
        except SessionExpiredError:
            pass

    def request_session_info(self) -> json.JSONData:
        """Requests the itunes session info, thus checking if the session is still valid.

        :returns: the dict with the session info.
        :raises SessionExpiredError: if the session is no longer valid.
        """
        assert self.state in [
            ClientState.NEW,
            ClientState.AUTHENTICATED,
            ClientState.EXPIRED,
        ], f"Actual client state: {self.state}"
        return self._request_session_info()

    def _request_session_info(self) -> json.JSONData:
        url = "https://appstoreconnect.apple.com/olympus/v1/session"
        logger.debug("GET %s", url)
        session_response = self.session.get(url, timeout=REQUEST_TIMEOUT)

        if session_response.ok:
            self.state = ClientState.AUTHENTICATED
            return session_response.json()
        else:
            self.state = ClientState.EXPIRED
            raise SessionExpiredError

    def request_available_providers(self) -> List[ITunesProvider]:
        """Return the organisations whom the user is member off.

        ITunes calls organisations providers.
        """
        assert self.state is ClientState.AUTHENTICATED, f"Actual client state: {self.state}"
        session_info = self.request_session_info()
        return [
            ITunesProvider(
                providerId=p["providerId"],
                publicProviderId=p["publicProviderId"],
                name=p["name"],
                contentTypes=p["contentTypes"],
                subType=p["subType"],
            )
            for p in session_info["availableProviders"]
        ]

    def set_provider(self, provider_id: PublicProviderId) -> None:
        """Sets the active organisation for the user in this session.

        ITunes allows users to be part of multiple organisations, or providers as it is called
        in the API.  On a session you need to activate one before you can use the apps of that
        organisation.
        """
        assert self.state is ClientState.AUTHENTICATED, f"Actual client state: {self.state}"

        # Collect list of valid provider IDs so we can give better error reporting.  iTunes
        # reports this confusingly.
        provider_ids: List[PublicProviderId] = [
            p.publicProviderId for p in self.request_available_providers()
        ]
        if provider_id not in provider_ids:
            raise ITunesError("Unknown provider_id")

        url = "https://appstoreconnect.apple.com/olympus/v1/providerSwitchRequests"
        logger.debug("POST %s", url)
        response = self.session.post(
            url,
            json={
                "data": {
                    "type": "providerSwitchRequests",
                    "relationships": {
                        "provider": {
                            "data": {
                                "type": "providers",
                                "id": provider_id,
                            }
                        }
                    },
                }
            },
            headers={"Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code != HTTPStatus.CREATED:
            raise ITunesError(f"Bad status code: {response.status_code}")

    def get_dsym_url(
        self, app_id: str, bundle_short_version: str, bundle_version: str, platform: str
    ) -> Optional[str]:
        """Returns the URL for a dsyms bundle or ``None``.

        :returns: The URL of the dSYM zipfile to download.  If the build was not a bitcode
           build and there are no dSYMs to download for it ``None`` is returned.

        :raises SessionExpiredError:
        """
        assert self.state is ClientState.AUTHENTICATED, f"Actual client state: {self.state}"
        with sentry_sdk.start_span(
            op="itunes-dsym-url", description="Request iTunes dSYM download URL"
        ):
            details_url = (
                f"https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/"
                f"{app_id}/platforms/{platform}/trains/{bundle_short_version}/builds/"
                f"{bundle_version}/details"
            )
            logger.debug("GET %s", details_url)
            response = self.session.get(details_url, timeout=REQUEST_TIMEOUT)

            if response.status_code == HTTPStatus.UNAUTHORIZED:
                self.state = ClientState.EXPIRED
                raise SessionExpiredError
            elif response.status_code == HTTPStatus.FORBIDDEN:
                raise ForbiddenError
            elif response.status_code != HTTPStatus.OK:
                raise ITunesError(f"Bad status code: {response.status_code}")

            data = response.json()
            dsym_url: Optional[str] = data["data"]["dsymurl"]
            return dsym_url
