import os

from sentry.logging import LoggingFormat
from sentry.options import (
    FLAG_ALLOW_EMPTY,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_REQUIRED,
    register,
)
from sentry.options.manager import FLAG_CREDENTIAL
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
register("system.secret-key", flags=FLAG_CREDENTIAL | FLAG_NOSTORE)
register("system.root-api-key", flags=FLAG_PRIORITIZE_DISK)
register("system.logging-format", default=LoggingFormat.HUMAN, flags=FLAG_NOSTORE)
# This is used for the chunk upload endpoint
register("system.upload-url-prefix", flags=FLAG_PRIORITIZE_DISK)
register("system.maximum-file-size", default=2**31, flags=FLAG_PRIORITIZE_DISK)

# URL configuration
# Absolute URL to the sentry root directory. Should not include a trailing slash.
register(
    "system.url-prefix",
    ttl=60,
    grace=3600,
    default=os.environ.get("SENTRY_SYSTEM_URL_PREFIX"),
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register("system.internal-url-prefix", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
# Base hostname that account domains are subdomains of.
register(
    "system.base-hostname",
    default=os.environ.get("SENTRY_SYSTEM_BASE_HOSTNAME"),
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_NOSTORE,
)
# The template for organization subdomain hostnames.
register(
    "system.organization-base-hostname",
    default=os.environ.get("SENTRY_ORGANIZATION_BASE_HOSTNAME"),
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_NOSTORE,
)
# Template for organization URL including protocol
register(
    "system.organization-url-template",
    default=os.environ.get("SENTRY_ORGANIZATION_URL_TEMPLATE"),
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_NOSTORE,
)
# Template for region based API URL
register(
    "system.region-api-url-template",
    default=os.environ.get("SENTRY_REGION_API_URL_TEMPLATE"),
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_NOSTORE,
)
# The region that this instance is currently running in.
register("system.region", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_NOSTORE)

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
register("mail.subject-prefix", default="[Sentry]", flags=FLAG_PRIORITIZE_DISK)
register("mail.from", default="root@localhost", flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.list-namespace", type=String, default="localhost", flags=FLAG_NOSTORE)
register("mail.enable-replies", default=False, flags=FLAG_PRIORITIZE_DISK)
register("mail.reply-hostname", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.mailgun-api-key", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.timeout", default=10, type=Int, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# TOTP (Auth app)
register(
    "totp.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# SMS
register("sms.twilio-account", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "sms.twilio-token", default="", flags=FLAG_CREDENTIAL | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK
)
register("sms.twilio-number", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "sms.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY,
)

# U2F
register("u2f.app-id", default="", flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("u2f.facets", default=(), type=Sequence, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "u2f.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# Recovery Codes
register(
    "recovery.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# Auth
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

# Replay Options
#
# Replay storage backend configuration (only applicable if the direct-storage driver is used)
register("replay.storage.backend", default=None, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    "replay.storage.options",
    type=Dict,
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)
# The sample rate at which to allow direct-storage access.  This is deterministic sampling based
# on organization-id.
register(
    "replay.storage.direct-storage-sample-rate",
    type=Int,
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)
# The sample rate at which to allow dom-click-search.
register(
    "replay.ingest.dom-click-search",
    type=Int,
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)

# Analytics
register("analytics.backend", default="noop", flags=FLAG_NOSTORE)
register("analytics.options", default={}, flags=FLAG_NOSTORE)

register("cloudflare.secret-key", default="", flags=FLAG_CREDENTIAL)

# Slack Integration
register("slack.client-id", flags=FLAG_PRIORITIZE_DISK)
register("slack.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
# signing-secret is preferred, but need to keep verification-token for apps that use it
register("slack.verification-token", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("slack.signing-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# Codecov Integration
register("codecov.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# GitHub Integration
register("github-app.id", default=0)
register("github-app.name", default="")
register("github-app.webhook-secret", default="", flags=FLAG_CREDENTIAL)
register("github-app.private-key", default="", flags=FLAG_CREDENTIAL)
register("github-app.client-id", flags=FLAG_PRIORITIZE_DISK)
register("github-app.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# GitHub Auth
register("github-login.client-id", default="", flags=FLAG_PRIORITIZE_DISK)
register("github-login.client-secret", default="", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register(
    "github-login.require-verified-email", type=Bool, default=False, flags=FLAG_PRIORITIZE_DISK
)
register("github-login.base-domain", default="github.com", flags=FLAG_PRIORITIZE_DISK)
register("github-login.api-domain", default="api.github.com", flags=FLAG_PRIORITIZE_DISK)
register("github-login.extended-permissions", type=Sequence, default=[], flags=FLAG_PRIORITIZE_DISK)
register("github-login.organization", flags=FLAG_PRIORITIZE_DISK)

# VSTS Integration
register("vsts.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vsts.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
# VSTS Integration - with limited scopes
register("vsts-limited.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vsts-limited.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# PagerDuty Integration
register("pagerduty.app-id", default="")

# Vercel Integration
register("vercel.client-id", flags=FLAG_PRIORITIZE_DISK)
register("vercel.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("vercel.integration-slug", default="sentry")

# MsTeams Integration
register("msteams.client-id", flags=FLAG_PRIORITIZE_DISK)
register("msteams.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("msteams.app-id")

# AWS Lambda Integration
register("aws-lambda.access-key-id", flags=FLAG_PRIORITIZE_DISK)
register("aws-lambda.secret-access-key", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("aws-lambda.cloudformation-url")
register("aws-lambda.account-number", default="943013980633")
register("aws-lambda.node.layer-name", default="SentryNodeServerlessSDK")
register("aws-lambda.node.layer-version")
register("aws-lambda.python.layer-name", default="SentryPythonServerlessSDK")
register("aws-lambda.python.layer-version")
# the region of the host account we use for assuming the role
register("aws-lambda.host-region", default="us-east-2")
# the number of threads we should use to install Lambdas
register("aws-lambda.thread-count", default=100)

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

# Enable use of Symbolicator Source Maps processing for specific projects.
register("symbolicator.sourcemaps-processing-projects", type=Sequence, default=[])
# Enable use of Symbolicator Source Maps processing for fraction of projects.
register("symbolicator.sourcemaps-processing-sample-rate", default=0.0)
# Use a fraction of Symbolicator Source Maps processing events for A/B testing.
register("symbolicator.sourcemaps-processing-ab-test", default=0.0)

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

# Enable use of symbolic-sourcemapcache for JavaScript Source Maps processing.
# Set this value of the fraction of projects that you want to use it for.
register("processing.sourcemapcache-processor", default=0.0)  # unused

# Killswitch for sending internal errors to the internal project or
# `SENTRY_SDK_CONFIG.relay_dsn`. Set to `0` to only send to
# `SENTRY_SDK_CONFIG.dsn` (the "upstream transport") and nothing else.
#
# Note: A value that is neither 0 nor 1 is regarded as 0
register("store.use-relay-dsn-sample-rate", default=1)

# A rate to apply to any events denoted as experimental to be sent to an experimental dsn.
register("store.use-experimental-dsn-sample-rate", default=0.0)

# Mock out integrations and services for tests
register("mocks.jira", default=False)

# Record statistics about event payloads and their compressibility
register("store.nodestore-stats-sample-rate", default=0.0)  # unused

# Killswitch to stop storing any reprocessing payloads.
register("store.reprocessing-force-disable", default=False)

register("store.race-free-group-creation-force-disable", default=False)

# Option to enable dart deobfuscation on ingest
register("processing.view-hierarchies-dart-deobfuscation", default=0.0)


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
register("api.organization.disable-last-deploys", type=Sequence, default=[])

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

# Minimum number of files in an archive. Archives with fewer files are extracted and have their
# contents stored as separate release files.
register("processing.release-archive-min-files", default=10)

# Try to read release artifacts from zip archives
register("processing.use-release-archives-sample-rate", default=0.0)  # unused

# All Relay options (statically authenticated Relays can be registered here)
register("relay.static_auth", default={}, flags=FLAG_NOSTORE)

# Tell Relay to stop extracting metrics from transaction payloads (see killswitches)
# Example value: [{"project_id": 42}, {"project_id": 123}]
register("relay.drop-transaction-metrics", default=[])

# [Unused] Sample rate for opting in orgs into transaction metrics extraction.
register("relay.transaction-metrics-org-sample-rate", default=0.0)

# Write new kafka headers in eventstream
register("eventstream:kafka-headers", default=True)

# Post process forwarder options
# Gets data from Kafka headers
register("post-process-forwarder:kafka-headers", default=True)

# Subscription queries sampling rate
register("subscriptions-query.sample-rate", default=0.01)

# The ratio of symbolication requests for which metrics will be submitted to redis.
#
# This is to allow gradual rollout of metrics collection for symbolication requests and can be
# removed once it is fully rolled out.
register("symbolicate-event.low-priority.metrics.submission-rate", default=0.0)

# Sampling rate for controlled rollout of a change where ignest-consumer spawns
# special save_event task for transactions avoiding the preprocess.
register("store.save-transactions-ingest-consumer-rate", default=0.0)

# Drop delete_old_primary_hash messages for a particular project.
register("reprocessing2.drop-delete-old-primary-hash", default=[])

# BEGIN PROJECT ABUSE QUOTAS

# Example:
# >>> org = Organization.objects.get(slug='foo')
# >>> org.update_option("project-abuse-quota.transaction-limit", 42)
# >>> for q in SubscriptionQuota()._get_abuse_quotas(org): print(q.to_json())
# {'id': 'pat', 'scope': 'project', 'categories': ['transaction'], 'limit': 420, 'window': 10, 'reasonCode': 'project_abuse_limit'}
# You can see that for this organization, 42 transactions per second
# is effectively enforced as 420/s because the rate limiting window is 10 seconds.

# DEPRECATED (only in use by getsentry).
# Use "project-abuse-quota.window" instead.
register("getsentry.rate-limit.window", type=Int, default=10, flags=FLAG_PRIORITIZE_DISK)

# Relay isn't effective at enforcing 1s windows - 10 seconds has worked well.
# If the limit is negative, then it means completely blocked.
# I don't see this value needing to be tweaked on a per-org basis,
# so for now the org option "project-abuse-quota.window" doesn't do anything.
register("project-abuse-quota.window", type=Int, default=10, flags=FLAG_PRIORITIZE_DISK)

# DEPRECATED. Use "project-abuse-quota.error-limit" instead.
# This is set to 0: don't limit by default, because it is configured in production.
# The DEPRECATED org option override is "sentry:project-error-limit".
register("getsentry.rate-limit.project-errors", type=Int, default=0, flags=FLAG_PRIORITIZE_DISK)
# DEPRECATED. Use "project-abuse-quota.transaction-limit" instead.
# This is set to 0: don't limit by default, because it is configured in production.
# The DEPRECATED org option override is "sentry:project-transaction-limit".
register(
    "getsentry.rate-limit.project-transactions",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK,
)

# These are set to 0: don't limit by default.
# These have yet to be configured in production.
# For errors and transactions, the above DEPRECATED options take
# precedence for now, until we decide on values to set for all these.
# Set the same key as an org option which will override these values for the org.
# Similarly, for now, the DEPRECATED org options "sentry:project-error-limit"
# and "sentry:project-transaction-limit" take precedence.
register("project-abuse-quota.error-limit", type=Int, default=0, flags=FLAG_PRIORITIZE_DISK)
register("project-abuse-quota.transaction-limit", type=Int, default=0, flags=FLAG_PRIORITIZE_DISK)
register("project-abuse-quota.attachment-limit", type=Int, default=0, flags=FLAG_PRIORITIZE_DISK)
register("project-abuse-quota.session-limit", type=Int, default=0, flags=FLAG_PRIORITIZE_DISK)

# END PROJECT ABUSE QUOTAS

# Send event messages for specific project IDs to random partitions in Kafka
# contents are a list of project IDs to message types to be randomly assigned
# e.g. [{"project_id": 2, "message_type": "error"}, {"project_id": 3, "message_type": "transaction"}]
register("kafka.send-project-events-to-random-partitions", default=[])

# Rate to project_configs_v3, no longer used.
register("relay.project-config-v3-enable", default=0.0)

# [Unused] Use zstandard compression in redis project config cache
# Set this value to a list of DSNs.
register("relay.project-config-cache-compress", default=[])  # unused

# [Unused] Use zstandard compression in redis project config cache
# Set this value of the fraction of config writes you want to compress.
register("relay.project-config-cache-compress-sample-rate", default=0.0)  # unused

# default brownout crontab for api deprecations
register("api.deprecation.brownout-cron", default="0 12 * * *", type=String)
# Brownout duration to be stored in ISO8601 format for durations (See https://en.wikipedia.org/wiki/ISO_8601#Durations)
register("api.deprecation.brownout-duration", default="PT1M")

# Flag to determine whether performance metrics indexer should index tag
# values or not
register("sentry-metrics.performance.index-tag-values", default=True)


# A slow rollout option for writing "new" cache keys
# as the transition from UseCaseKey to UseCaseID occurs
register("sentry-metrics.indexer.cache-key-rollout-rate", default=0.0)

# A option for double writing old and new cache keys
# for the same transition
register("sentry-metrics.indexer.cache-key-double-write", default=False)

# Global and per-organization limits on the writes to the string indexer's DB.
#
# Format is a list of dictionaries of format {
#   "window_seconds": ...,
#   "granularity_seconds": ...,
#   "limit": ...
# }
#
# See sentry.ratelimiters.sliding_windows for an explanation of what each of
# those terms mean.
#
# Note that changing either window or granularity_seconds of a limit will
# effectively reset it, as the previous data can't/won't be converted.
register("sentry-metrics.writes-limiter.limits.performance.per-org", default=[])
register("sentry-metrics.writes-limiter.limits.releasehealth.per-org", default=[])
register("sentry-metrics.writes-limiter.limits.performance.global", default=[])
register("sentry-metrics.writes-limiter.limits.releasehealth.global", default=[])

# per-organization limits on the number of timeseries that can be observed in
# each window.
#
# Format is a list of dictionaries of format {
#   "window_seconds": ...,
#   "granularity_seconds": ...,
#   "limit": ...
# }
#
# See sentry.ratelimiters.cardinality for an explanation of what each of
# those terms mean.
#
# Note that changing either window or granularity_seconds of a limit will
# effectively reset it, as the previous data can't/won't be converted.
register("sentry-metrics.cardinality-limiter.limits.performance.per-org", default=[])
register("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org", default=[])
register("sentry-metrics.cardinality-limiter.orgs-rollout-rate", default=0.0)
register("sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate", default=0.0)

register("sentry-metrics.producer-schema-validation.release-health.rollout-rate", default=0.0)
register("sentry-metrics.producer-schema-validation.performance.rollout-rate", default=0.0)

# Flag to determine whether abnormal_mechanism tag should be extracted
register("sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate", default=0.0)

# Performance issue option for *all* performance issues detection
register("performance.issues.all.problem-detection", default=0.0)

# Individual system-wide options in case we need to turn off specific detectors for load concerns, ignoring the set project options.
register("performance.issues.compressed_assets.problem-creation", default=0.0)
register("performance.issues.compressed_assets.la-rollout", default=0.0)
register("performance.issues.compressed_assets.ea-rollout", default=0.0)
register("performance.issues.compressed_assets.ga-rollout", default=0.0)
register("performance.issues.consecutive_db.problem-creation", default=0.0)
register("performance.issues.consecutive_db.la-rollout", default=0.0)
register("performance.issues.consecutive_db.ea-rollout", default=0.0)
register("performance.issues.consecutive_db.ga-rollout", default=0.0)
register("performance.issues.n_plus_one_db.problem-detection", default=0.0)
register("performance.issues.n_plus_one_db.problem-creation", default=0.0)
register("performance.issues.n_plus_one_db_ext.problem-creation", default=0.0)
register("performance.issues.file_io_main_thread.problem-creation", default=0.0)
register("performance.issues.db_main_thread.problem-creation", default=0.0)
register("performance.issues.n_plus_one_api_calls.problem-creation", default=0.0)
register("performance.issues.n_plus_one_api_calls.la-rollout", default=0.0)
register("performance.issues.n_plus_one_api_calls.ea-rollout", default=0.0)
register("performance.issues.n_plus_one_api_calls.ga-rollout", default=0.0)
register("performance.issues.slow_db_query.problem-creation", default=0.0)
register("performance.issues.slow_db_query.la-rollout", default=0.0)
register("performance.issues.slow_db_query.ea-rollout", default=0.0)
register("performance.issues.slow_db_query.ga-rollout", default=0.0)
register("performance.issues.render_blocking_assets.problem-creation", default=0.0)
register("performance.issues.render_blocking_assets.la-rollout", default=0.0)
register("performance.issues.render_blocking_assets.ea-rollout", default=0.0)
register("performance.issues.render_blocking_assets.ga-rollout", default=0.0)
register("performance.issues.m_n_plus_one_db.problem-creation", default=0.0)
register("performance.issues.m_n_plus_one_db.la-rollout", default=0.0)
register("performance.issues.m_n_plus_one_db.ea-rollout", default=0.0)
register("performance.issues.m_n_plus_one_db.ga-rollout", default=0.0)


# System-wide options for default performance detection settings for any org opted into the performance-issues-ingest feature. Meant for rollout.
register("performance.issues.n_plus_one_db.count_threshold", default=5)
register("performance.issues.n_plus_one_db.duration_threshold", default=100.0)
register("performance.issues.render_blocking_assets.fcp_minimum_threshold", default=2000.0)
register("performance.issues.render_blocking_assets.fcp_maximum_threshold", default=10000.0)
register("performance.issues.render_blocking_assets.fcp_ratio_threshold", default=0.33)
register("performance.issues.render_blocking_assets.size_threshold", default=1000000)
register("performance.issues.consecutive_http.max_duration_between_spans", default=1000)
register("performance.issues.consecutive_http.consecutive_count_threshold", default=3)
register("performance.issues.consecutive_http.span_duration_threshold", default=1000)
register("performance.issues.large_http_payload.size_threshold", default=1000000)  # 1MB


# Dynamic Sampling system wide options
# Killswitch to disable new dynamic sampling behavior specifically new dynamic sampling biases
register("dynamic-sampling:enabled-biases", default=True)
# System-wide options that observes latest releases on transactions and caches these values to be used later in
# project config computation. This is temporary option to monitor the performance of this feature.
register("dynamic-sampling:boost-latest-release", default=False)
register("dynamic-sampling.prioritise_projects.sample_rate", default=0.0)
# Size of the sliding window used for dynamic sampling. It is defaulted to 24 hours.
register("dynamic-sampling:sliding_window.size", default=24)
# controls how many orgs will be queried by the prioritise by transaction task
# 0-> no orgs , 0.5 -> half of the orgs, 1.0 -> all orgs
register("dynamic-sampling.prioritise_transactions.load_rate", default=0.0)
# the number of large transactions to retrieve from Snuba for transaction re-balancing
register("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions", 30)
# the number of large transactions to retrieve from Snuba for transaction re-balancing
register("dynamic-sampling.prioritise_transactions.num_explicit_small_transactions", 0)
# controls the intensity of dynamic sampling transaction rebalancing. 0.0 = explict rebalancing
# not performed, 1.0= full rebalancing (tries to bring everything to mean). Note that even at 0.0
# there will still be some rebalancing between the explicit and implicit transactions ( so setting rebalancing
# to 0.0 is not the same as no rebalancing. To effectively disable rebalancing set the number of explicit
# transactions to be rebalance (both small and large) to 0
register(
    "dynamic-sampling.prioritise_transactions.rebalance_intensity",
    default=0.8,
    flags=FLAG_MODIFIABLE_RATE,
)
register("hybrid_cloud.outbox_rate", default=0.0)
# controls whether we allow people to upload artifact bundles instead of release bundles
register("sourcemaps.enable-artifact-bundles", default=0.0)
# Decides whether an incoming transaction triggers an update of the clustering rule applied to it.
register("txnames.bump-lifetime-sample-rate", default=0.1)
