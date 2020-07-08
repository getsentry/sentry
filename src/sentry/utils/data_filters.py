from __future__ import absolute_import

from sentry import tsdb
from sentry.relay.utils import to_camel_case_name


class FilterStatKeys(object):
    """
    NOTE: This enum also exists in Relay, check if alignment is needed when
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
    DISCARDED_HASH = "discarded-hash"  # Not replicated in Relay
    CRASH_REPORT_LIMIT = "crash-report-limit"  # Not replicated in Relay


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


def get_filter_key(flt):
    return to_camel_case_name(flt.id.replace("-", "_"))
