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
from typing import Any, List, NewType, Optional

import requests
import sentry_sdk
from requests import Session

from sentry.utils import json, safe

logger = logging.getLogger(__name__)


SESSION_COOKIE_NAME = "myacinfo"


class ITunesSessionExpiredException(Exception):
    """The iTunes Session is expired."""

    pass


def load_session_cookie(session: Session, session_cookie_value: str) -> None:
    """Loads the itunes session cookie in the current session.

    If the iTunes session is still valid the user will be logged in inside the session.
    """

    session.cookies.set(SESSION_COOKIE_NAME, session_cookie_value)  # type: ignore


def get_session_cookie(session: Session) -> Optional[str]:
    """Extracts the session cookies.

    :return: the session cookie if available
    """
    return session.cookies.get(SESSION_COOKIE_NAME)  # type: ignore


def get_session_info(session: Session) -> Optional[Any]:
    """
    Returns the itunes session info (if valid).

    Note: port of fastlane.spaceship.client.Spaceship.Client.fetch_olympus_session

    :return: The session information (a json) if the session is valid and no login is necessary None if we need to
    login
    """
    url = " https://appstoreconnect.apple.com/olympus/v1/session"
    logger.debug(f"GET {url}")
    session_response = session.get(url)

    if session_response.ok:
        try:
            data = session_response.json()
        except ValueError:
            return None
        return data

    return None


ITunesServiceKey = NewType("ITunesServiceKey", str)


def get_auth_service_key(session: Session) -> ITunesServiceKey:
    """
    Obtains the authentication service key used in X-Apple-Widget-Key header
    :return: the service key to be used in all future calls X-Apple-Widget-Key headers
    """
    logger.debug(
        "GET https://appstoreconnect.apple.com/olympus/v1/app/config?hostname=itunesconnect.apple.com"
    )
    svc_key_response = session.get(
        "https://appstoreconnect.apple.com/olympus/v1/app/config?hostname=itunesconnect.apple.com"
    )

    try:
        data = svc_key_response.json()
        return ITunesServiceKey(data.get("authServiceKey"))
    except (ValueError, KeyError) as err:
        err_msg = "Could not obtain service key"
        logger.info(err_msg, exc_info=True)
        raise ValueError(err_msg, "auth-service-key") from err


ITunesHeaders = namedtuple("ITunesHeaders", ["session_id", "scnt"])


def initiate_login(
    session: Session, service_key: str, account_name: str, password: str
) -> Optional[ITunesHeaders]:
    """
    Initiate an Itunes login session, and get the header values needed for Itunes API calls.

    This will also initiate a validation call to any validated machine and display to the user
    a request for authorization (followed by giving a validation id).
    :return: ITunesHeaders to be used in further calls
    """
    logger.debug("POST https://idmsa.apple.com/appleauth/auth/signin")

    start_login = session.post(
        "https://idmsa.apple.com/appleauth/auth/signin",
        json={
            "accountName": account_name,
            "password": password,
            "rememberMe": True,
        },
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "X-Apple-Widget-Key": service_key,
            "Accept": "application/json, text/javascript",
        },
    )

    if start_login.status_code == HTTPStatus.OK:
        # this is rather strange the user doesn't have 2 factor auth
        return None
    if start_login.status_code == HTTPStatus.CONFLICT:
        return ITunesHeaders(
            session_id=start_login.headers["x-apple-id-session-id"],
            scnt=start_login.headers["scnt"],
        )
    else:
        return None


TrustedPhoneInfo = namedtuple(
    "TrustedPhoneInfo", ["id", "push_mode", "number_with_dial_code", "obfuscated_number"]
)


def get_trusted_phone_info(
    session: Session, service_key: ITunesServiceKey, headers: ITunesHeaders
) -> Optional[TrustedPhoneInfo]:
    """
    Will return the trusted phone info for the account
    :return: TrustedPhoneInfo if the call was successful
    """
    url = "https://idmsa.apple.com/appleauth/auth"
    logger.debug(f"GET {url}")

    auth_response = session.get(
        url,
        headers={
            "scnt": headers.scnt,
            "X-Apple-Id-Session-Id": headers.session_id,
            "Accept": "application/json",
            "X-Apple-Widget-Key": service_key,
        },
    )

    if auth_response.status_code == HTTPStatus.OK:
        try:
            info = auth_response.json()["trustedPhoneNumber"]
            return TrustedPhoneInfo(
                id=info["id"],
                push_mode=info["pushMode"],
                number_with_dial_code=info["numberWithDialCode"],
                obfuscated_number=info["obfuscatedNumber"],
            )
        except:  # NOQA
            logger.info("Could not obtain trusted phone info", exc_info=True)
            return None

    return None


def initiate_phone_login(
    session: Session,
    service_key: ITunesServiceKey,
    headers: ITunesHeaders,
    phone_id: int,
    push_mode: str,
) -> bool:
    """
    Start phone 2 factor authentication by requesting an SMS to be send to the trusted phone
    """
    url = "https://idmsa.apple.com/appleauth/auth/verify/phone"
    logger.debug(f"PUT {url}")

    phone_auth_response = session.put(
        url,
        json={"phoneNumber": {"id": phone_id}, "mode": push_mode},
        headers={
            "scnt": headers.scnt,
            "X-Apple-Id-Session-Id": headers.session_id,
            "Accept": "application/json",
            "X-Apple-Widget-Key": service_key,
            "Content-Type": "application/json",
        },
    )
    return phone_auth_response.status_code == HTTPStatus.OK


def send_phone_authentication_confirmation_code(
    session: Session,
    service_key: ITunesServiceKey,
    headers: ITunesHeaders,
    phone_id: int,
    push_mode: str,
    security_code: str,
) -> bool:
    """
    Sends the confirmation code received by the trusted phone and completes the two factor authentication
    :return: True if successful False otherwise
    """
    url = "https://idmsa.apple.com/appleauth/auth/verify/phone/securitycode"
    logger.debug("PUT {url}")

    phone_security_code_response = session.post(
        url,
        json={
            "securityCode": {"code": security_code},
            "phoneNumber": {"id": phone_id},
            "mode": push_mode,
        },
        headers={
            "scnt": headers.scnt,
            "X-Apple-Id-Session-Id": headers.session_id,
            "Accept": "application/json",
            "X-Apple-Widget-Key": service_key,
        },
    )
    if phone_security_code_response.status_code == HTTPStatus.OK:
        return True

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

    return False


def send_authentication_confirmation_code(
    session: Session, service_key: ITunesServiceKey, headers: ITunesHeaders, security_code: str
) -> bool:
    """
    Sends the confirmation code received by the trusted device and completes the two factor authentication

    :return: True if successful False otherwise
    """
    url = "https://idmsa.apple.com/appleauth/auth/verify/trusteddevice/securitycode"
    logger.debug(f"POST {url}")

    response = session.post(
        url,
        json={
            "securityCode": {
                "code": security_code,
            }
        },
        headers={
            "scnt": headers.scnt,
            "X-Apple-Id-Session-Id": headers.session_id,
            "Accept": "application/json",
            "X-Apple-Widget-Key": service_key,
        },
    )

    return response.ok


def get_dsym_url(
    session: Session, app_id: str, bundle_short_version: str, bundle_version: str, platform: str
) -> Optional[str]:
    """
    Returns the url for a dsyms bundle. The session must be logged in.
    :return: The url to use for downloading the dsyms bundle
    """
    with sentry_sdk.start_span(
        op="itunes-dsym-url", description="Request iTunes dSYM download URL"
    ):
        details_url = (
            f"https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/"
            f"{app_id}/platforms/{platform}/trains/{bundle_short_version}/builds/"
            f"{bundle_version}/details"
        )

        logger.debug(f"GET {details_url}")

        details_response = session.get(details_url)

        # A non-OK status code will probably mean an expired token/session
        if details_response.status_code == HTTPStatus.UNAUTHORIZED:
            raise ITunesSessionExpiredException
        if details_response.status_code == HTTPStatus.OK:
            try:
                data = details_response.json()
                dsym_url: Optional[str] = safe.get_path(data, "data", "dsymurl")
                return dsym_url
            except Exception as e:
                logger.info(
                    "Could not obtain dSYM info for "
                    "app id=%s, bundle_short=%s, bundle=%s, platform=%s",
                    app_id,
                    bundle_short_version,
                    bundle_version,
                    platform,
                    exc_info=True,
                )
                raise e
        return None


class ITunesError(Exception):
    """Generic error communicating with iTunes."""

    pass


class InvalidTwoFactorAuthError(ITunesError):
    """An invalid two-factor authentication code was provided."""

    pass


class InvalidSmsAuthError(ITunesError):
    """An invalid SMS authentication code was provided."""

    pass


class SessionExpiredError(ITunesError):
    """The iTunes session has expired."""

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


class ClientState(enum.Enum):
    NEW = enum.auto()
    AUTH_REQUESTED = enum.auto()
    SMS_AUTH_REQUESTED = enum.auto()
    AUTHENTICATED = enum.auto()
    EXPIRED = enum.auto()


class ITunesClient:
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

        # The trusted phone info, set by :meth:`_request_trusted_phone_info`.
        self._trusted_phone: Optional[TrustedPhoneInfo] = None

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

    def request_auth_service_key(self) -> ITunesServiceKey:
        """Obtains the authentication service key used in X-Apple-Widget-Key header.

        This key is pretty static and can be cached long-term, saving a request to fetch it.
        It can optionally be provided to :meth:`init`.

        :returns: the service key to be used in all future calls X-Apple-Widget-Key headers.

        :raises: any exception in case of failure.
        """
        url = "https://appstoreconnect.apple.com/olympus/v1/app/config?hostname=itunesconnect.apple.com"
        logger.debug("GET %s", url)
        response = self.session.get(url)
        data = response.json()
        return ITunesServiceKey(data["authServiceKey"])

    def start_login_sequence(self, username: str, password: str) -> None:
        """Starts the login process.

        This will trigger the two factor authentication code to show on any validated device
        for the user.  The code must be provided using :meth:`auth_code`.

        Alternatively after calling this you can switch to SMS two factor authentication by
        calling :meth:`request_sms`.
        """
        assert self.state in [ClientState.NEW, ClientState.EXPIRED]
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
        )

        if start_login.status_code == http.HTTPStatus.OK:
            raise ITunesError(
                f"Two factor auth not enabled for user, status_code={start_login.status_code}"
            )
        if start_login.status_code == http.HTTPStatus.CONFLICT:
            self._session_id = start_login.headers["x-apple-id-session-id"]
            self._scnt = start_login.headers["scnt"]
            self.state = ClientState.AUTH_REQUESTED
        else:
            raise ITunesError(f"Unexpected status code form signing: {start_login.status_code}")

    def two_factor_code(self, code: str) -> None:
        """Sends the two-factor authentication code, completing authentication.

        :raises: :class:`InvalidTwoFactorAuthError`
        """
        assert self.state is ClientState.AUTH_REQUESTED
        url = "https://idmsa.apple.com/appleauth/auth/verify/trusteddevice/securitycode"
        logger.debug(f"POST {url}")
        response = self.session.post(
            url,
            json={
                "securityCode": {
                    "code": code,
                }
            },
            headers={
                "scnt": self._scnt,
                "X-Apple-Id-Session-Id": self._session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
        )
        if not response.ok:
            raise InvalidTwoFactorAuthError
        else:
            self.state = ClientState.AUTHENTICATED

    def _request_trusted_phone_info(self) -> None:
        """Requests the trusted phone info for the account."""
        assert self.state is ClientState.AUTH_REQUESTED
        url = "https://idmsa.apple.com/appleauth/auth"
        logger.debug("GET %s", url)
        response = self.session.get(
            url,
            headers={
                "scnt": self._scnt,
                "X-Apple-Id-Session-Id": self._session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
        )
        if response.status_code != HTTPStatus.OK:
            raise ITunesError(f"Unexpected response status: {response.status_code}")
        info = response.json()["trustedPhoneNumber"]
        self._trusted_phone = TrustedPhoneInfo(
            id=info["id"],
            push_mode=info["pushMode"],
            number_with_dial_code=info["numberWithDialCode"],
            obfuscated_number=info["obfuscatedNumber"],
        )

    def request_sms_auth(self) -> None:
        """Requests sending the authentication code to a trusted phone.

        :raises ITunesError: if there was an error requesting to use the trusted phone.
        """
        assert self.state is ClientState.AUTH_REQUESTED
        self._request_trusted_phone_info()
        assert self._trusted_phone is not None
        url = "https://idmsa.apple.com/appleauth/auth/verify/phone"
        logger.debug("PUT %s", url)
        response = self.session.put(
            url,
            json={
                "phoneNumber": {"id": self._trusted_phone.id},
                "mode": self._trusted_phone.push_mode,
            },
            headers={
                "scnt": self._scnt,
                "X-Apple-Id-Session-Id": self._session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
                "Content-Type": "application/json",
            },
        )
        if response.status_code != HTTPStatus.OK:
            raise ITunesError("Unexpected response status: {response.status_code}")
        self.state = ClientState.SMS_AUTH_REQUESTED

    def sms_code(self, code: str) -> None:
        """Sends the SMS auth code, completing authentication.

        :raises InvalidSmsAuthError:
        """
        assert self.state is ClientState.SMS_AUTH_REQUESTED
        assert self._trusted_phone is not None
        url = "https://idmsa.apple.com/appleauth/auth/verify/phone/securitycode"
        logger.debug("PUT {url}")
        response = self.session.post(
            url,
            json={
                "securityCode": {"code": code},
                "phoneNumber": {"id": self._trusted_phone.id},
                "mode": self._trusted_phone.push_mode,
            },
            headers={
                "scnt": self._scnt,
                "X-Apple-Id-Session-Id": self._session_id,
                "Accept": "application/json",
                "X-Apple-Widget-Key": self.service_key,
            },
        )
        if response.status_code != HTTPStatus.OK:
            raise InvalidSmsAuthError
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
        assert self.state is ClientState.AUTHENTICATED
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
        assert self.state in [ClientState.NEW, ClientState.AUTHENTICATED, ClientState.EXPIRED]
        return self._request_session_info()

    def _request_session_info(self) -> json.JSONData:
        url = " https://appstoreconnect.apple.com/olympus/v1/session"
        logger.debug("GET %s", url)
        session_response = self.session.get(url)

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
        assert self.state is ClientState.AUTHENTICATED
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
        assert self.state is ClientState.AUTHENTICATED

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
        )
        if response.status_code != HTTPStatus.CREATED:
            raise ITunesError(f"Bad status code: {response.status_code}")

    def get_dsym_url(
        self, app_id: str, bundle_short_version: str, bundle_version: str, platform: str
    ) -> str:
        """Returns the URL for a dsyms bundle.

        :raises SessionExpiredError:
        """
        assert self.state is ClientState.AUTHENTICATED
        with sentry_sdk.start_span(
            op="itunes-dsym-url", description="Request iTunes dSYM download URL"
        ):
            details_url = (
                f"https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/"
                f"{app_id}/platforms/{platform}/trains/{bundle_short_version}/builds/"
                f"{bundle_version}/details"
            )
            logger.debug("GET %s", details_url)
            response = self.session.get(details_url)

            if response.status_code == HTTPStatus.UNAUTHORIZED:
                self.state = ClientState.EXPIRED
                raise SessionExpiredError
            elif response.status_code != HTTPStatus.OK:
                raise ITunesError(f"Bad status code: {response.status_code}")

            data = response.json()
            dsym_url: str = data["data"]["dsymurl"]
            return dsym_url
