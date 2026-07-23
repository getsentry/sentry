from sentry.tsdb.base import TSDBModel


class FilterStatKeys:
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
    HEALTH_CHECK = "filtered-transaction"  # Ignore health-check transactions


FILTER_STAT_KEYS_TO_VALUES = {
    FilterStatKeys.IP_ADDRESS: TSDBModel.project_total_received_ip_address,
    FilterStatKeys.RELEASE_VERSION: TSDBModel.project_total_received_release_version,
    FilterStatKeys.ERROR_MESSAGE: TSDBModel.project_total_received_error_message,
    FilterStatKeys.BROWSER_EXTENSION: TSDBModel.project_total_received_browser_extensions,
    FilterStatKeys.LEGACY_BROWSER: TSDBModel.project_total_received_legacy_browsers,
    FilterStatKeys.LOCALHOST: TSDBModel.project_total_received_localhost,
    FilterStatKeys.WEB_CRAWLER: TSDBModel.project_total_received_web_crawlers,
    FilterStatKeys.INVALID_CSP: TSDBModel.project_total_received_invalid_csp,
    FilterStatKeys.CORS: TSDBModel.project_total_received_cors,
    FilterStatKeys.DISCARDED_HASH: TSDBModel.project_total_received_discarded,
    FilterStatKeys.HEALTH_CHECK: TSDBModel.project_total_healthcheck,
}


class FilterTypes:
    ERROR_MESSAGES = "error_messages"
    RELEASES = "releases"
    LOG_MESSAGES = "log_messages"
    TRACE_METRIC_NAMES = "trace_metric_names"
