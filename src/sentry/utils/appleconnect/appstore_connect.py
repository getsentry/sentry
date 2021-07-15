import logging
import time
from collections import namedtuple
from typing import Any, Dict, Generator, List, Mapping, Optional, Union

import sentry_sdk
from requests import Session

from sentry.utils import jwt, safe
from sentry.utils.json import JSONData

logger = logging.getLogger(__name__)

AppConnectCredentials = namedtuple("AppConnectCredentials", ["key_id", "key", "issuer_id"])


def _get_authorization_header(
    credentials: AppConnectCredentials, expiry_sec: Optional[int] = None
) -> Mapping[str, str]:
    """Creates a JWT (javascript web token) for use with app store connect API

    All requests to app store connect require an "Authorization" header build as below.

    Note: The maximum allowed expiry time is 20 minutes.  The default is somewhat shorter
    than that to avoid running into the limit.

    :return: the Bearer auth token to be added as the  "Authorization" header
    """
    if expiry_sec is None:
        expiry_sec = 60 * 10  # default to 10 mins
    with sentry_sdk.start_span(op="jwt", description="Generating AppStoreConnect JWT token"):
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
        return jwt.authorization_header(token)


def _get_appstore_json(
    session: Session, credentials: AppConnectCredentials, url: str
) -> Mapping[str, Any]:
    """Returns response data from an appstore URL.

    It builds and makes the request and extracts the data from the response.

    :returns: a dictionary with the requested data or None if the call fails.

    :raises ValueError: if the request failed or the response body could not be parsed as
       JSON.
    """
    with sentry_sdk.start_span(op="appconnect-request", description="AppStoreConnect API request"):
        headers = _get_authorization_header(credentials)

        if not url.startswith("https://"):
            full_url = "https://api.appstoreconnect.apple.com"
            if url[0] != "/":
                full_url += "/"
        else:
            full_url = ""
        full_url += url
        logger.debug(f"GET {full_url}")
        with sentry_sdk.start_span(op="http", description="AppStoreConnect request"):
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
    with sentry_sdk.start_span(
        op="appconnect-list-builds", description="List all AppStoreConnect builds"
    ):
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
        result = []

        for page in pages:

            # Collect the related data sent in this page so we can look it up by (type, id).
            included_relations = {}
            for relation in page["included"]:
                rel_type = relation["type"]
                rel_id = relation["id"]
                included_relations[(rel_type, rel_id)] = relation

            def get_related(data: JSONData, relation: str) -> Union[None, JSONData]:
                """Returns related data by looking it up in all the related data included in the page.

                This first looks up the related object in the data provided under the
                `relationships` key.  Then it uses the `type` and `id` of this key to look up
                the actual data in `included_relations` which is an index of all related data
                returned with the page.

                If the `relation` does not exist in `data` then `None` is returned.
                """
                rel_ptr_data = safe.get_path(data, "relationships", relation, "data")
                if rel_ptr_data is None:
                    # The query asks for both the appStoreVersion and preReleaseVersion
                    # relations to be included.  However for each build there could be only one
                    # of these that will have the data with type and id, the other will have
                    # None for data.
                    return None
                rel_type = rel_ptr_data["type"]
                rel_id = rel_ptr_data["id"]
                return included_relations[(rel_type, rel_id)]

            for build in page["data"]:
                try:
                    related_appstore_version = get_related(build, "appStoreVersion")
                    related_prerelease_version = get_related(build, "preReleaseVersion")

                    # Normally release versions also have a matching prerelease version, the
                    # platform and version number for them should be identical.  Nevertheless
                    # because we would likely see the build first with a prerelease version
                    # before it also has a release version we prefer to stick with that one if
                    # it is available.
                    if related_prerelease_version:
                        version = related_prerelease_version["attributes"]["version"]
                        platform = related_prerelease_version["attributes"]["platform"]
                    elif related_appstore_version:
                        version = related_appstore_version["attributes"]["versionString"]
                        platform = related_appstore_version["attributes"]["platform"]
                    else:
                        raise KeyError("missing related version")
                    build_number = build["attributes"]["version"]

                    result.append(
                        {"platform": platform, "version": version, "build_number": build_number}
                    )
                except Exception:
                    logger.error(
                        "Failed to process AppStoreConnect build from API: %s", build, exc_info=True
                    )

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
