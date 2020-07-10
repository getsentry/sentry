from __future__ import absolute_import
from sentry.projectoptions import register

# latest epoch
LATEST_EPOCH = 6

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
register(
    key="sentry:grouping_config",
    epoch_defaults={
        1: LEGACY_GROUPING_CONFIG,
        3: "newstyle:2019-05-08",
        4: DEFAULT_GROUPING_CONFIG,
    },
)

# Grouping enhancements defaults
LEGACY_GROUPING_ENHANCEMENTS_BASE = "legacy:2019-03-12"
DEFAULT_GROUPING_ENHANCEMENTS_BASE = "common:2019-03-23"
register(
    key="sentry:grouping_enhancements_base",
    epoch_defaults={1: LEGACY_GROUPING_ENHANCEMENTS_BASE, 3: DEFAULT_GROUPING_ENHANCEMENTS_BASE},
)
register(key="sentry:grouping_enhancements", default=u"")

# server side fingerprinting defaults.
register(key="sentry:fingerprinting_rules", default=u"")

# The JavaScript loader version that is the project default.  This option
# is expected to be never set but the epoch defaults are used if no
# version is set on a project's DSN.
register(key="sentry:default_loader_version", epoch_defaults={1: "4.x", 2: "5.x"})

# Default symbol sources.  The ios source does not exist by default and
# will be skipped later.  The microsoft source exists by default and is
# unlikely to be disabled.
register(
    key="sentry:builtin_symbol_sources",
    epoch_defaults={1: ["ios"], 2: ["ios", "microsoft"], 5: ["ios", "microsoft", "android"]},
)

# Default legacy-browsers filter
register(key="filters:legacy-browsers", epoch_defaults={1: "0"})

# Default legacy-browsers filter
register(key="filters:web-crawlers", epoch_defaults={1: "1", 6: "0"})

# Default legacy-browsers filter
register(key="filters:browser-extensions", epoch_defaults={1: "0"})

# Default legacy-browsers filter
register(key="filters:localhost", epoch_defaults={1: "0"})
