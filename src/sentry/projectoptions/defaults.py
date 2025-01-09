from sentry.constants import TARGET_SAMPLE_RATE_DEFAULT
from sentry.projectoptions import register

# This controls what sentry:option-epoch value is given to a project when it is created
# The epoch of a project will determine what options are valid options for that specific project
LATEST_EPOCH = 13

# grouping related configs
#
# The default values are hardcoded because some grouping configs might
# only exists temporarily for testing purposes.  If we delete them from
# the codebase and a customer still has them set in the options we want to
# fall back to the oldest config.
#
# TODO: we might instead want to fall back to the latest of the project's
# epoch instead.
LEGACY_GROUPING_CONFIG = "legacy:2019-03-12"
DEFAULT_GROUPING_CONFIG = "newstyle:2023-01-11"
# NOTE: this is empty for now to migrate projects off the deprecated
# `mobile` strategy via grouping auto-updates.
BETA_GROUPING_CONFIG = ""
# This registers the option as a valid project option
register(
    key="sentry:grouping_config",
    epoch_defaults={
        1: LEGACY_GROUPING_CONFIG,
        3: "newstyle:2019-05-08",
        4: DEFAULT_GROUPING_CONFIG,
    },
)

register(key="sentry:grouping_enhancements", default="")

# server side fingerprinting defaults.
register(key="sentry:fingerprinting_rules", default="")

# Secondary grouping setup to run in addition for transition phase.
#
# To ensure we minimize unnecessary load, we ttl the secondary grouping setup
# to 90 days, as that's when all groups should have hashes associated with
# them.
register(key="sentry:secondary_grouping_expiry", default=0)
register(key="sentry:secondary_grouping_config", default=None)

# Has this project had its issues backfilled into the Seer database, and if so, when did the
# backfill complete? (This is a temporary way to flag projects as we roll out Seer grouping, because
# it can be flipped on in the backfill script, unlike inclusion in a getsentry feature handler.)
register(key="sentry:similarity_backfill_completed", default=None)


# The JavaScript loader version that is the project default.  This option
# is expected to be never set but the epoch defaults are used if no
# version is set on a project's DSN.
register(
    key="sentry:default_loader_version",
    epoch_defaults={1: "4.x", 2: "5.x", 7: "6.x", 8: "7.x", 13: "8.x"},
)

# Default symbol sources.  The ios source does not exist by default and
# will be skipped later.  The microsoft source exists by default and is
# unlikely to be disabled.
register(
    key="sentry:builtin_symbol_sources",
    epoch_defaults={
        1: ["ios"],
        2: ["ios", "microsoft"],
        5: ["ios", "microsoft", "android"],
        9: ["ios", "microsoft", "android", "nuget"],
    },
)

# Default legacy-browsers filter
register(key="filters:legacy-browsers", epoch_defaults={1: "0"})

# Default web crawlers filter
register(key="filters:web-crawlers", epoch_defaults={1: "1", 6: "0"})

# Default browser extensions filter
register(key="filters:browser-extensions", epoch_defaults={1: "0"})

# Default localhost filter
register(key="filters:localhost", epoch_defaults={1: "0"})

# Default react hydration errors filter
register(key="filters:react-hydration-errors", epoch_defaults={1: "1"})

# Default NextJS chunk load error filter
register(key="filters:chunk-load-error", epoch_defaults={1: "1"})

# Default breakdowns config
register(
    key="sentry:breakdowns",
    epoch_defaults={
        1: {
            "span_ops": {
                "type": "spanOperations",
                "matches": ["http", "db", "browser", "resource", "ui"],
            }
        },
    },
)

# NOTE: this is the HealthCheck filter, the name should match Relay reason (which is filtered-transaction)
register(key="filters:filtered-transaction", default="1")

# Which user-defined tags should be copied from transaction events to the
# extracted performance metrics.
register(key="sentry:transaction_metrics_custom_tags", epoch_defaults={1: []})

DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS = {
    "uncompressed_assets_detection_enabled": True,
    "consecutive_http_spans_detection_enabled": True,
    "large_http_payload_detection_enabled": True,
    "n_plus_one_db_queries_detection_enabled": True,
    "n_plus_one_api_calls_detection_enabled": True,
    "db_on_main_thread_detection_enabled": True,
    "file_io_on_main_thread_detection_enabled": True,
    "consecutive_db_queries_detection_enabled": True,
    "large_render_blocking_asset_detection_enabled": True,
    "slow_db_queries_detection_enabled": True,
    "http_overhead_detection_enabled": True,
    "transaction_duration_regression_detection_enabled": True,
    "function_duration_regression_detection_enabled": True,
}

DEFAULT_PROJECT_PERFORMANCE_GENERAL_SETTINGS = {
    "enable_images": False,
}

# A dict containing all the specific detection thresholds and rates.
register(
    key="sentry:performance_issue_settings",
    default=DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS,
)

register(
    key="sentry:performance_general_settings",
    default=DEFAULT_PROJECT_PERFORMANCE_GENERAL_SETTINGS,
)

register(
    key="sentry:replay_rage_click_issues",
    default=True,
)

register(
    key="sentry:replay_hydration_error_issues",
    default=True,
)

register(
    key="sentry:toolbar_allowed_origins",
    default=[],
)

register(
    key="sentry:feedback_user_report_notifications",
    epoch_defaults={12: True},
)

register(
    key="sentry:feedback_ai_spam_detection",
    default=True,
)


# Replacement rules for transaction names discovered by the transaction clusterer.
# Contains a mapping from rule to last seen timestamp,
# for example `{"/organizations/*/**": 1334318402}`
register(key="sentry:transaction_name_cluster_rules", default={})

# The JavaScript loader dynamic SDK options that are the project defaults.
register(
    key="sentry:default_loader_options",
    epoch_defaults={
        10: {
            "hasPerformance": True,
            "hasReplay": True,
        }
    },
)

# The available loader SDK versions
register(
    key="sentry:loader_available_sdk_versions",
    epoch_defaults={1: ["8.x", "7.x", "6.x", "5.x", "4.x"], 11: ["8.x", "7.x"]},
)

# Dynamic sampling rate in project-level "manual" configuration mode
register(key="sentry:target_sample_rate", default=TARGET_SAMPLE_RATE_DEFAULT)

# Should tempest fetch screenshots for this project
register(key="sentry:tempest_fetch_screenshots", default=False)
