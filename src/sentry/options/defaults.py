from sentry.logging import LoggingFormat
from sentry.options import (
    FLAG_ALLOW_EMPTY,
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_REQUIRED,
    register,
)
from sentry.utils.types import Any, Bool, Dict, Int, Sequence, String

# Cache
# register('cache.backend', flags=FLAG_NOSTORE)
# register('cache.options', type=Dict, flags=FLAG_NOSTORE)

# System
register("system.admin-email", flags=FLAG_REQUIRED)
register("system.support-email", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("system.security-email", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("system.databases", type=Dict, flags=FLAG_NOSTORE)
# register('system.debug', default=False, flags=FLAG_NOSTORE)
register("system.rate-limit", default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("system.event-retention-days", default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("system.secret-key", flags=FLAG_NOSTORE)
# Absolute URL to the sentry root directory. Should not include a trailing slash.
register("system.url-prefix", ttl=60, grace=3600, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("system.internal-url-prefix", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("system.root-api-key", flags=FLAG_PRIORITIZE_DISK)
register("system.logging-format", default=LoggingFormat.HUMAN, flags=FLAG_NOSTORE)
# This is used for the chunk upload endpoint
register("system.upload-url-prefix", flags=FLAG_PRIORITIZE_DISK)
register("system.maximum-file-size", default=2 ** 31, flags=FLAG_PRIORITIZE_DISK)

# Redis
register(
    "redis.clusters",
    type=Dict,
    default={"default": {"hosts": {0: {"host": "127.0.0.1", "port": 6379}}}},
    flags=FLAG_NOSTORE | FLAG_IMMUTABLE,
)
register("redis.options", type=Dict, flags=FLAG_NOSTORE)

# Processing worker caches
register(
    "dsym.cache-path", type=String, default="/tmp/sentry-dsym-cache", flags=FLAG_PRIORITIZE_DISK
)
register(
    "releasefile.cache-path",
    type=String,
    default="/tmp/sentry-releasefile-cache",
    flags=FLAG_PRIORITIZE_DISK,
)
register("releasefile.cache-limit", type=Int, default=10 * 1024 * 1024, flags=FLAG_PRIORITIZE_DISK)
register(
    "releasefile.cache-max-archive-size",
    type=Int,
    default=1024 * 1024 * 1024,
    flags=FLAG_PRIORITIZE_DISK,
)


# Mail
register("mail.backend", default="smtp", flags=FLAG_NOSTORE)
register("mail.host", default="127.0.0.1", flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.port", default=25, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.username", flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.password", flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.use-tls", default=False, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.use-ssl", default=False, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.subject-prefix", default="[Sentry] ", flags=FLAG_PRIORITIZE_DISK)
register("mail.from", default="root@localhost", flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.list-namespace", type=String, default="localhost", flags=FLAG_NOSTORE)
register("mail.enable-replies", default=False, flags=FLAG_PRIORITIZE_DISK)
register("mail.reply-hostname", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.mailgun-api-key", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.timeout", default=10, type=Int, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# SMS
register("sms.twilio-account", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("sms.twilio-token", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("sms.twilio-number", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# U2F
register("u2f.app-id", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("u2f.facets", default=(), type=Sequence, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

register("auth.ip-rate-limit", default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("auth.user-rate-limit", default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "auth.allow-registration",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_REQUIRED,
)

register("api.rate-limit.org-create", default=5, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# Beacon
register("beacon.anonymous", type=Bool, flags=FLAG_REQUIRED)

# Filestore
register("filestore.backend", default="filesystem", flags=FLAG_NOSTORE)
register("filestore.options", default={"location": "/tmp/sentry-files"}, flags=FLAG_NOSTORE)

# Symbol server
register("symbolserver.enabled", default=False, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "symbolserver.options",
    default={"url": "http://127.0.0.1:3000"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# Symbolicator
register("symbolicator.enabled", default=False, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "symbolicator.options",
    default={"url": "http://localhost:3021"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# The ratio of requests for which the new stackwalking method should be compared against the old one
register("symbolicator.compare_stackwalking_methods_rate", default=0.0)

# Killswitch for symbolication sources, based on a list of source IDs. Meant to be used in extreme
# situations where it is preferable to break symbolication in a few places as opposed to letting
# it break everywhere.
register("symbolicator.ignored_sources", type=Sequence, default=(), flags=FLAG_ALLOW_EMPTY)

# Backend chart rendering via chartcuterie
register("chart-rendering.enabled", default=False, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "chart-rendering.chartcuterie",
    default={"url": "http://localhost:7901"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)
# Leaving these empty will use the same storage driver configured for
# Filestore
register(
    "chart-rendering.storage.backend", default=None, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK
)
register(
    "chart-rendering.storage.options",
    type=Dict,
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# Analytics
register("analytics.backend", default="noop", flags=FLAG_NOSTORE)
register("analytics.options", default={}, flags=FLAG_NOSTORE)

register("cloudflare.secret-key", default="")

# Slack Integration
register("slack.client-id", flags=FLAG_PRIORITIZE_DISK)
register("slack.client-secret", flags=FLAG_PRIORITIZE_DISK)
# signing-secret is preferred, but need to keep verification-token for apps that use it
register("slack.verification-token", flags=FLAG_PRIORITIZE_DISK)
register("slack.signing-secret", flags=FLAG_PRIORITIZE_DISK)

# GitHub Integration
register("github-app.id", default=0)
register("github-app.name", default="")
register("github-app.webhook-secret", default="")
register("github-app.private-key", default="")
register("github-app.client-id", flags=FLAG_PRIORITIZE_DISK)
register("github-app.client-secret", flags=FLAG_PRIORITIZE_DISK)

# GitHub Auth
register("github-login.client-id", default="", flags=FLAG_PRIORITIZE_DISK)
register("github-login.client-secret", default="", flags=FLAG_PRIORITIZE_DISK)
register(
    "github-login.require-verified-email", type=Bool, default=False, flags=FLAG_PRIORITIZE_DISK
)
register("github-login.base-domain", default="github.com", flags=FLAG_PRIORITIZE_DISK)
register("github-login.api-domain", default="api.github.com", flags=FLAG_PRIORITIZE_DISK)
register("github-login.extended-permissions", type=Sequence, default=[], flags=FLAG_PRIORITIZE_DISK)
register("github-login.organization", flags=FLAG_PRIORITIZE_DISK)

# VSTS Integration
register("vsts.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vsts.client-secret", flags=FLAG_PRIORITIZE_DISK)
# VSTS Integration - with limited scopes
register("vsts-limited.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vsts-limited.client-secret", flags=FLAG_PRIORITIZE_DISK)

# PagerDuty Integration
register("pagerduty.app-id", default="")

# Vercel Integration
register("vercel.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vercel.client-secret", flags=FLAG_PRIORITIZE_DISK)
register("vercel.integration-slug", default="sentry")

# MsTeams Integration
register("msteams.client-id", flags=FLAG_PRIORITIZE_DISK)
register("msteams.client-secret", flags=FLAG_PRIORITIZE_DISK)
register("msteams.app-id")

# AWS Lambda Integration
register("aws-lambda.access-key-id", flags=FLAG_PRIORITIZE_DISK)
register("aws-lambda.secret-access-key", flags=FLAG_PRIORITIZE_DISK)
register("aws-lambda.cloudformation-url")
register("aws-lambda.account-number", default="943013980633")
register("aws-lambda.node.layer-name", default="SentryNodeServerlessSDK")
register("aws-lambda.node.layer-version")
register("aws-lambda.python.layer-name", default="SentryPythonServerlessSDK")
register("aws-lambda.python.layer-version")
# the region of the host account we use for assuming the role
register("aws-lambda.host-region", default="us-east-2")

# Snuba
register("snuba.search.pre-snuba-candidates-optimizer", type=Bool, default=False)
register("snuba.search.pre-snuba-candidates-percentage", default=0.2)
register("snuba.search.project-group-count-cache-time", default=24 * 60 * 60)
register("snuba.search.min-pre-snuba-candidates", default=500)
register("snuba.search.max-pre-snuba-candidates", default=5000)
register("snuba.search.chunk-growth-rate", default=1.5)
register("snuba.search.max-chunk-size", default=2000)
register("snuba.search.max-total-chunk-time-seconds", default=30.0)
register("snuba.search.hits-sample-size", default=100)
register("snuba.track-outcomes-sample-rate", default=0.0)

# The percentage of tagkeys that we want to cache. Set to 1.0 in order to cache everything, <=0.0 to stop caching
register("snuba.tagstore.cache-tagkeys-rate", default=0.0, flags=FLAG_PRIORITIZE_DISK)

# Kafka Publisher
register("kafka-publisher.raw-event-sample-rate", default=0.0)
register("kafka-publisher.max-event-size", default=100000)

# Ingest refactor
register("store.projects-normalize-in-rust-opt-in", type=Sequence, default=[])  # unused
register("store.projects-normalize-in-rust-opt-out", type=Sequence, default=[])  # unused
# positive value means stable opt-in in the range 0.0 to 1.0, negative value
# means random opt-in with the same range.
register("store.projects-normalize-in-rust-percent-opt-in", default=0.0)  # unused

# From 0.0 to 1.0: Randomly disable normalization code in interfaces when loading from db
register("store.empty-interface-sample-rate", default=0.0)

# Enable multiple topics for eventstream. It allows specific event types to be sent
# to specific topic.
register("store.eventstream-per-type-topic", default=False, flags=FLAG_PRIORITIZE_DISK)

# if this is turned to `True` sentry will behave like relay would do with
# regards to filter responses.
register("store.lie-about-filter-status", default=False)

# Toggles between processing transactions directly in the ingest consumer
# (``False``) and spawning a save_event task (``True``).
register("store.transactions-celery", default=False)  # unused

# Symbolicator refactors
# - Disabling minidump stackwalking in endpoints
register("symbolicator.minidump-refactor-projects-opt-in", type=Sequence, default=[])  # unused
register("symbolicator.minidump-refactor-projects-opt-out", type=Sequence, default=[])  # unused
register("symbolicator.minidump-refactor-random-sampling", default=0.0)  # unused


# Normalization after processors
register("store.normalize-after-processing", default=0.0)  # unused
register("store.disable-trim-in-renormalization", default=0.0)  # unused

# Data scrubbing in Rust
register("store.sample-rust-data-scrubber", default=0.0)  # unused
register("store.use-rust-data-scrubber", default=False)  # unused

# Post Process Error Hook Sampling
register("post-process.use-error-hook-sampling", default=False)  # unused
# From 0.0 to 1.0: Randomly enqueue process_resource_change task
register("post-process.error-hook-sample-rate", default=0.0)  # unused

# Transaction events
# True => kill switch to disable ingestion of transaction events for internal project.
register("transaction-events.force-disable-internal-project", default=False)

# Moving signals and TSDB into outcomes consumer
register("outcomes.signals-in-consumer-sample-rate", default=0.0)  # unused
register("outcomes.tsdb-in-consumer-sample-rate", default=0.0)  # unused

# Node data save rate
register("nodedata.cache-sample-rate", default=0.0, flags=FLAG_PRIORITIZE_DISK)
register("nodedata.cache-on-save", default=False, flags=FLAG_PRIORITIZE_DISK)

# Use nodestore for eventstore.get_events
register("eventstore.use-nodestore", default=False, flags=FLAG_PRIORITIZE_DISK)

# Alerts / Workflow incremental rollout rate. Tied to feature handlers in getsentry
register("workflow.rollout-rate", default=0, flags=FLAG_PRIORITIZE_DISK)

# Performance metric alerts incremental rollout rate. Tied to feature handlers
# in getsentry
register("incidents-performance.rollout-rate", default=0, flags=FLAG_PRIORITIZE_DISK)

# Max number of tags to combine in a single query in Discover2 tags facet.
register("discover2.max_tags_to_combine", default=3, flags=FLAG_PRIORITIZE_DISK)

# Enables setting a sampling rate when producing the tag facet.
register("discover2.tags_facet_enable_sampling", default=True, flags=FLAG_PRIORITIZE_DISK)

# Killswitch for datascrubbing after stacktrace processing. Set to False to
# disable datascrubbers.
register("processing.can-use-scrubbers", default=True)

# Killswitch for sending internal errors to the internal project or
# `SENTRY_SDK_CONFIG.relay_dsn`. Set to `0` to only send to
# `SENTRY_SDK_CONFIG.dsn` (the "upstream transport") and nothing else.
#
# Note: A value that is neither 0 nor 1 is regarded as 0
register("store.use-relay-dsn-sample-rate", default=1)

# Mock out integrations and services for tests
register("mocks.jira", default=False)

# Record statistics about event payloads and their compressibility
register("store.nodestore-stats-sample-rate", default=0.0)  # unused

# Killswitch to stop storing any reprocessing payloads.
register("store.reprocessing-force-disable", default=False)

register("store.race-free-group-creation-force-disable", default=False)


# ## sentry.killswitches
#
# The following options are documented in sentry.killswitches in more detail
register("store.load-shed-group-creation-projects", type=Any, default=[])
register("store.load-shed-pipeline-projects", type=Any, default=[])
register("store.load-shed-parsed-pipeline-projects", type=Any, default=[])
register("store.load-shed-save-event-projects", type=Any, default=[])
register("store.load-shed-process-event-projects", type=Any, default=[])
register("store.load-shed-symbolicate-event-projects", type=Any, default=[])
register("store.symbolicate-event-lpq-never", type=Sequence, default=[])
register("store.symbolicate-event-lpq-always", type=Sequence, default=[])
register("post_process.get-autoassign-owners", type=Sequence, default=[])

# Switch for more performant project counter incr
register("store.projectcounter-modern-upsert-sample-rate", default=0.0)

# Run an experimental grouping config in background for performance analysis
register("store.background-grouping-config-id", default=None)

# Fraction of events that will pass through background grouping
register("store.background-grouping-sample-rate", default=0.0)

# True if background grouping should run before secondary and primary grouping
register("store.background-grouping-before", default=False)

# Store release files bundled as zip files
register("processing.save-release-archives", default=False)  # unused

# Minimum number of files in an archive. Small archives are extracted and its contents
# are stored as separate release files.
register("processing.release-archive-min-files", default=10)

# Try to read release artifacts from zip archives
register("processing.use-release-archives-sample-rate", default=0.0)  # unused

# All Relay options (statically authenticated Relays can be registered here)
register("relay.static_auth", default={}, flags=FLAG_NOSTORE)

# Write new kafka headers in eventstream
register("eventstream:kafka-headers", default=False)

# Post process forwarder options
# Gets data from Kafka headers
register("post-process-forwarder:kafka-headers", default=False)
# Number of threads to use for post processing
register("post-process-forwarder:concurrency", default=1)

# Subscription queries sampling rate
register("subscriptions-query.sample-rate", default=0.01)

# The ratio of symbolication requests for which metrics will be submitted to redis.
#
# This is to allow gradual rollout of metrics collection for symbolication requests and can be
# removed once it is fully rolled out.
register("symbolicate-event.low-priority.metrics.submission-rate", default=0.0)

# This is to enable the ingestion of suspect spans by project ids.
register("performance.suspect-spans-ingestion-projects", default={})
# This is to enable the ingestion of suspect spans by project groups.
register("performance.suspect-spans-ingestion.rollout-rate", default=0)

# Sampling rate for controlled rollout of a change where ignest-consumer spawns
# special save_event task for transactions avoiding the preprocess.
register("store.save-transactions-ingest-consumer-rate", default=0.0)

# Drop delete_old_primary_hash messages for a particular project.
register("reprocessing2.drop-delete-old-primary-hash", default=[])
