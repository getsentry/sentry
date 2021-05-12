import logging
import time
from collections import namedtuple
from typing import Any, Generator, List, Mapping, Optional

import jwt
from requests import Session

from sentry.utils import safe

logger = logging.getLogger(__name__)

AppConnectCredentials = namedtuple("AppConnectCredentials", ["key_id", "key", "issuer_id"])


def _get_authorization_header(credentials=AppConnectCredentials, expiry_sec=None) -> str:
    """
    Creates a JWT (javascript web token) for use with app store connect API

    All requests to app store connect require an "Authorization" header build as below.

    Note: Setting a very large expiry for the token will cause the authorization to fail,
    the default is one hour, which should be suitable for most cases.

    :return: the Bearer auth token to be added as the  "Authorization" header
    """
    if expiry_sec is None:
        expiry_sec = 60 * 60  # default one hour
    token = jwt.encode(
        {
            "iss": credentials.issuer_id,
            "exp": int(time.time()) + expiry_sec,
            "aud": "appstoreconnect-v1",
        },
        credentials.key,
        algorithm="ES256",
        headers={"kid": credentials.key_id, "alg": "ES256", "typ": "JWT"},
    )
    return f"Bearer {token}"


def _get_appstore_info(
    session: Session, credentials: AppConnectCredentials, url: str
) -> Optional[Mapping[str, Any]]:
    """
    Get info from an appstore url

    It builds the request, and extracts the data

    :return: a dictionary with the requested data or None if the call fails
    """
    headers = {"Authorization": _get_authorization_header(credentials)}

    if not url.startswith("https://"):
        full_url = "https://api.appstoreconnect.apple.com"
        if url[0] != "/":
            full_url += "/"
    else:
        full_url = ""
    full_url += url
    logger.debug(f"GET {full_url}")
    response = session.get(full_url, headers=headers)
    if not response.ok:
        raise ValueError("Request failed", full_url, response.status_code, response.text)
    try:
        return response.json()
    except Exception as e:
        raise ValueError(
            "Response body not JSON", full_url, response.status_code, response.text
        ) from e


def _get_next_page(response_json) -> str:
    """
    Gets the next page url from a app store connect paged response
    """
    return safe.get_path(response_json, "links", "next")


def _get_appstore_info_paged_data(
    session: Session, credentials: AppConnectCredentials, url: str
) -> Generator[Any, None, None]:
    """
    Iterate through all the pages from a paged response and concatenate the `data` part of the response

    App store connect share the general format:

    data:
      - list of elements
    links:
      next: link to the next page
    ...

    The function iterates through all pages (following the next link) until
    there is no next page, and returns a generator containing all
    the data in the arrays from each call

    :return: a generator with the contents of all the arrays from each page (flattened).
    """
    while url is not None:
        response = _get_appstore_info(session, credentials, url)
        data = response["data"]
        yield from data
        url = _get_next_page(response)


def get_pre_release_version_info(session: Session, credentials: AppConnectCredentials, app_id: str):
    """
    Get all prerelease builds version information for an application

    The release build version information has the following structure:
    platform: str - the platform for the build (e.g. IOS, MAC_OS ...)
    short_version: str - the short version build info ( e.g. '1.0.1'), also called "train" in starship documentation
    id: str - the IID of the version
    versions: vec - a vector with builds
        version: str - the version of the build (e.g. '101'), looks like the build number
        id: str - the IID of the build

    NOTE: the pre release version information is identical to the release version information
    :return: a list of prerelease builds version information (see above)
    """
    url = f"v1/apps/{app_id}/preReleaseVersions"
    data = _get_appstore_info_paged_data(session, credentials, url)
    result = []
    for d in data:
        versions = []
        v = {
            "platform": safe.get_path(d, "attributes", "platform"),
            "short_version": safe.get_path(d, "attributes", "version"),
            "id": safe.get_path(d, "id"),
            "versions": versions,
        }
        builds_url = safe.get_path(d, "relationships", "builds", "links", "related")
        for build in _get_appstore_info_paged_data(session, credentials, builds_url):
            b = {
                "version": safe.get_path(build, "attributes", "version"),
                "id": safe.get_path(build, "id"),
            }
            versions.append(b)
        result.append(v)

    return result


def get_release_version_info(session: Session, credentials: AppConnectCredentials, app_id: str):
    """
    Get all release builds version information for an application

    The release build version information has the following structure:
    platform: str - the platform for the build (e.g. IOS, MAC_OS ...)
    short_version: str - the short version build info ( e.g. '1.0.1'), also called "train" in starship documentation
    id: str - the IID of the version
    versions: vec - a vector with builds
        version: str - the version of the build (e.g. '101'), looks like the build number
        id: str - the IID of the build

    NOTE: the release version information is identical to the pre release version information
    :return: a list of release builds version information (see above)
    """
    url = f"v1/apps/{app_id}/appStoreVersions"
    data = _get_appstore_info_paged_data(session, credentials, url)
    result = []
    for d in data:
        versions = []
        build_url = safe.get_path(d, "relationships", "build", "links", "related")
        v = {
            "platform": safe.get_path(d, "attributes", "platform"),
            "short_version": safe.get_path(d, "attributes", "versionString"),
            "id": safe.get_path(d, "id"),
            "versions": versions,
        }

        build_info = _get_appstore_info_paged_data(session, credentials, build_url)
        build_info = safe.get_path(build_info, "data")
        if build_info is not None:
            # Note RaduW: never seen info in this structure, I assume the same structure as pre release
            versions.append(
                {
                    "id": safe.get_path(build_info, "id"),
                    "version": safe.get_path(build_info, "attributes", "version"),
                }
            )
        result.append(v)
    return result


def get_build_info(session: Session, credentials: AppConnectCredentials, app_id: str):
    """
    Returns the build info for an application
    """
    return {
        "pre_releases": get_pre_release_version_info(session, credentials, app_id),
        "releases": get_release_version_info(session, credentials, app_id),
    }


AppInfo = namedtuple("AppInfo", ["name", "bundle_id", "app_id"])


def get_apps(session: Session, credentials: AppConnectCredentials) -> Optional[List[AppInfo]]:
    """
    Returns the available applications from an account
    :return: a list of available applications or None if the login failed, an empty list
    means that the login was successful but there were no applications available
    """
    url = "v1/apps"
    ret_val = []
    try:
        apps = _get_appstore_info_paged_data(session, credentials, url)
        for app in apps:
            app_info = AppInfo(
                app_id=app.get("id"),
                bundle_id=safe.get_path(app, "attributes", "bundleId"),
                name=safe.get_path(app, "attributes", "name"),
            )
            if (
                app_info.app_id is not None
                and app_info.bundle_id is not None
                and app_info.name is not None
            ):
                ret_val.append(app_info)
    except ValueError:
        return None
    return ret_val
