from sentry.projectoptions import register

# latest epoch
LATEST_EPOCH = 11

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
DEFAULT_GROUPING_CONFIG = "newstyle:2019-10-29"
# NOTE: this is empty for now to migrate projects off the deprecated
# `mobile` strategy via grouping auto-updates.
BETA_GROUPING_CONFIG = ""
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

# is auto upgrading enabled?
register(key="sentry:grouping_auto_update", default=True)

# The JavaScript loader version that is the project default.  This option
# is expected to be never set but the epoch defaults are used if no
# version is set on a project's DSN.
register(
    key="sentry:default_loader_version", epoch_defaults={1: "4.x", 2: "5.x", 7: "6.x", 8: "7.x"}
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

# Which user-defined tags should be copied from transaction events to the
# extracted performance metrics.
register(key="sentry:transaction_metrics_custom_tags", epoch_defaults={1: []})

# Default span attributes config
register(key="sentry:span_attributes", epoch_defaults={1: ["exclusive-time"]})

DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS = {
    "n_plus_one_db_detection_rate": 1.0,
    "n_plus_one_api_calls_detection_rate": 1.0,
    "consecutive_db_queries_detection_rate": 1.0,
    "uncompressed_assets_detection_enabled": True,
    "consecutive_http_spans_detection_enabled": True,
}
# A dict containing all the specific detection thresholds and rates.
register(
    key="sentry:performance_issue_settings",
    default=DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS,
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
    epoch_defaults={1: ["latest", "7.x", "6.x", "5.x", "4.x"], 11: ["latest", "7.x"]},
)
