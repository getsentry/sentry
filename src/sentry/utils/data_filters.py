from __future__ import absolute_import

import fnmatch
import ipaddress
import six

from django.utils.encoding import force_text

from sentry import tsdb
from sentry.utils.safe import get_path
from sentry.relay.utils import to_camel_case_name


class FilterStatKeys(object):
    """
    NOTE: This enum also exists in semaphore, check if alignment is needed when
    editing this.
    """

    IP_ADDRESS = "ip-address"
    RELEASE_VERSION = "release-version"
    ERROR_MESSAGE = "error-message"
    BROWSER_EXTENSION = "browser-extensions"
    LEGACY_BROWSER = "legacy-browsers"
    LOCALHOST = "localhost"
    WEB_CRAWLER = "web-crawlers"
    INVALID_CSP = "invalid-csp"
    CORS = "cors"
    DISCARDED_HASH = "discarded-hash"


FILTER_STAT_KEYS_TO_VALUES = {
    FilterStatKeys.IP_ADDRESS: tsdb.models.project_total_received_ip_address,
    FilterStatKeys.RELEASE_VERSION: tsdb.models.project_total_received_release_version,
    FilterStatKeys.ERROR_MESSAGE: tsdb.models.project_total_received_error_message,
    FilterStatKeys.BROWSER_EXTENSION: tsdb.models.project_total_received_browser_extensions,
    FilterStatKeys.LEGACY_BROWSER: tsdb.models.project_total_received_legacy_browsers,
    FilterStatKeys.LOCALHOST: tsdb.models.project_total_received_localhost,
    FilterStatKeys.WEB_CRAWLER: tsdb.models.project_total_received_web_crawlers,
    FilterStatKeys.INVALID_CSP: tsdb.models.project_total_received_invalid_csp,
    FilterStatKeys.CORS: tsdb.models.project_total_received_cors,
    FilterStatKeys.DISCARDED_HASH: tsdb.models.project_total_received_discarded,
}


class FilterTypes(object):
    ERROR_MESSAGES = "error_messages"
    RELEASES = "releases"


def is_valid_ip(project_config, ip_address):
    """
    Verify that an IP address is not being blacklisted
    for the given project.
    """
    blacklist = get_path(project_config.config, "filterSettings", "clientIps", "blacklistedIps")
    if not blacklist:
        return True

    for addr in blacklist:
        # We want to error fast if it's an exact match
        if ip_address == addr:
            return False

        # Check to make sure it's actually a range before
        try:
            if "/" in addr and (
                ipaddress.ip_address(six.text_type(ip_address))
                in ipaddress.ip_network(six.text_type(addr), strict=False)
            ):
                return False
        except ValueError:
            # Ignore invalid values here
            pass

    return True


def is_valid_release(project_config, release):
    """
    Verify that a release is not being filtered
    for the given project.
    """
    invalid_versions = get_path(project_config.config, "filterSettings", "releases", "releases")

    if not invalid_versions:
        return True

    release = force_text(release).lower()

    for version in invalid_versions:
        if fnmatch.fnmatch(release, version.lower()):
            return False

    return True


def is_valid_error_message(project_config, message):
    """
    Verify that an error message is not being filtered
    for the given project.
    """
    filtered_errors = get_path(project_config.config["filterSettings"], "errorMessages", "patterns")

    if not filtered_errors:
        return True

    message = force_text(message).lower()

    for error in filtered_errors:
        try:
            if fnmatch.fnmatch(message, error.lower()):
                return False
        except Exception:
            # fnmatch raises a string when the pattern is bad.
            # Patterns come from end users and can be full of mistakes.
            pass

    return True


def get_filter_key(flt):
    return to_camel_case_name(flt.spec.id.replace("-", "_"))
