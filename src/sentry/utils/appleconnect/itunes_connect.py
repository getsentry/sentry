"""
Contains functionality ported from fastlane-starship for getting app store connect information
using the old (itunes) api
"""

import logging
from collections import namedtuple
from http import HTTPStatus
from typing import Any, NewType, Optional

from requests import Session

from sentry.utils import safe

logger = logging.getLogger(__name__)


def _session_cookie_name() -> str:
    """Returns the name of the cookie used by itunes API for the session"""
    return "myacinfo"


def load_session_cookie(session: Session, session_cookie_value: str):
    """
    Tries to load the Itunes session cookie in the current session.

    If the session is still valid the user will be logged in.

    """

    session.cookies.set(_session_cookie_name(), session_cookie_value)


def get_session_cookie(session: Session) -> Optional[str]:
    """
    Tries to extract the session cookies

    :return: the session cookie if available
    """
    return session.cookies.get(_session_cookie_name())


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


def set_provider(session: Session, content_provider_id: int, user_id: str):
    url = "https://appstoreconnect.apple.com//WebObjects/iTunesConnect.woa/ra/v1/session/webSession"
    logger.debug(f"POST {url}")

    select_provider_response = session.post(
        url,
        json={
            "contentProviderId": content_provider_id,
            "dsId": user_id,
        },
    )
    return select_provider_response


def get_dsym_url(
    session: Session, app_id: str, bundle_short_version: str, bundle_version: str, platform: str
) -> Optional[str]:
    """
    Returns the url for a dsyms bundle. The session must be logged in.
    :return: The url to use for downloading the dsyms bundle
    """
    details_url = (
        f"https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/"
        f"{app_id}/platforms/{platform}/trains/{bundle_short_version}/builds/"
        f"{bundle_version}/details"
    )

    logger.debug(f" GET {details_url}")

    details_response = session.get(details_url)

    if details_response.status_code == HTTPStatus.OK:
        try:
            data = details_response.json()
            return safe.get_path(data, "data", "dsymurl")
        except:  # NOQA
            logger.info(
                f"Could not obtain dsms info for app id={app_id}, bundle_short={bundle_short_version}, "
                f"bundle={bundle_version}, platform={platform}",
                exc_info=True,
            )
            return None
    return None
