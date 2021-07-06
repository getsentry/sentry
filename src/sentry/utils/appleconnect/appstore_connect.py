import logging
import time
from collections import namedtuple
from typing import Any, Dict, Generator, List, Mapping, Optional

import jwt
from requests import Session

from sentry.utils import safe
from sentry.utils.json import JSONData

logger = logging.getLogger(__name__)

AppConnectCredentials = namedtuple("AppConnectCredentials", ["key_id", "key", "issuer_id"])


def _get_authorization_header(
    credentials: AppConnectCredentials, expiry_sec: Optional[int] = None
) -> str:
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


def _get_appstore_json(
    session: Session, credentials: AppConnectCredentials, url: str
) -> Mapping[str, Any]:
    """Returns response data from an appstore URL.

    It builds and makes the request and extracts the data from the response.

    :returns: a dictionary with the requested data or None if the call fails.

    :raises ValueError: if the request failed or the response body could not be parsed as
       JSON.
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
        return response.json()  # type: ignore
    except Exception as e:
        raise ValueError(
            "Response body not JSON", full_url, response.status_code, response.text
        ) from e


def _get_next_page(response_json: Mapping[str, Any]) -> Optional[str]:
    """Gets the URL for the next page from an App Store Connect paged response."""
    return safe.get_path(response_json, "links", "next")  # type: ignore


def _get_appstore_info_paged(
    session: Session, credentials: AppConnectCredentials, url: str
) -> Generator[Any, None, None]:
    """Iterates through all the pages from a paged response.

    App Store Connect responses shares the general format:

    data:
      - list of elements
    included:
      - list of included relations as requested
    links:
      next: link to the next page
    ...

    The function iterates through all pages (following the next link) until
    there is no next page, and returns a generator containing all pages

    :return: a generator with the pages.
    """
    next_url: Optional[str] = url
    while next_url is not None:
        response = _get_appstore_json(session, credentials, next_url)
        yield response
        next_url = _get_next_page(response)


def get_build_info(
    session: Session, credentials: AppConnectCredentials, app_id: str
) -> List[Dict[str, Any]]:
    """Returns the build infos for an application.

    The release build version information has the following structure:
    platform: str - the platform for the build (e.g. IOS, MAC_OS ...)
    version: str - the short version build info ( e.g. '1.0.1'), also called "train"
       in starship documentation
    build_number: str - the version of the build (e.g. '101'), looks like the build number
    """

    result = []

    # https://developer.apple.com/documentation/appstoreconnectapi/list_builds
    url = (
        f"v1/builds?filter[app]={app_id}"
        # we can fetch a maximum of 200 builds at once, so do that
        "&limit=200"
        # include related AppStore/PreRelease versions with the response
        # NOTE: the `iris` web API has related `buildBundles` objects,
        # which have very useful `includesSymbols` and `dSYMUrl` attributes,
        # but this is sadly not available in the official API. :-(
        # Open this in your browser when you are signed into AppStoreConnect:
        # https://appstoreconnect.apple.com/iris/v1/builds?filter[processingState]=VALID&include=appStoreVersion,preReleaseVersion,buildBundles&limit=1&filter[app]=XYZ
        "&include=appStoreVersion,preReleaseVersion"
        # sort newer releases first
        "&sort=-uploadedDate"
        # only include valid builds
        "&filter[processingState]=VALID"
        # and builds that have not expired yet
        "&filter[expired]=false"
    )
    pages = _get_appstore_info_paged(session, credentials, url)

    for page in pages:
        included_relations = {}
        for included in safe.get_path(page, "included", default=[]):
            type = safe.get_path(included, "type")
            id = safe.get_path(included, "id")
            if type is not None and id is not None:
                included_relations[(type, id)] = included

        def get_related(relation: JSONData) -> JSONData:
            type = safe.get_path(relation, "data", "type")
            id = safe.get_path(relation, "data", "id")
            if type is None or id is None:
                return None
            return included_relations.get((type, id))

        for build in safe.get_path(page, "data", default=[]):
            related_appstore_version = get_related(
                safe.get_path(build, "relationships", "appStoreVersion")
            )
            related_prerelease_version = get_related(
                safe.get_path(build, "relationships", "preReleaseVersion")
            )
            related_version = related_appstore_version or related_prerelease_version
            if not related_version:
                logger.error("Missing related version for AppStoreConnect `build`")
                continue
            platform = safe.get_path(related_version, "attributes", "platform")
            version = safe.get_path(related_version, "attributes", "versionString")
            build_number = safe.get_path(build, "attributes", "version")
            if platform is not None and version is not None and build_number is not None:
                result.append(
                    {"platform": platform, "version": version, "build_number": build_number}
                )
            else:
                logger.error("Malformed AppStoreConnect `builds` data")

    return result


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
        app_pages = _get_appstore_info_paged(session, credentials, url)
        for app_page in app_pages:
            for app in safe.get_path(app_page, "data", default=[]):
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
                else:
                    logger.error("Malformed AppStoreConnect `apps` data")
    except ValueError:
        return None
    return ret_val
