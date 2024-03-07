import os

from sentry.logging import LoggingFormat
from sentry.options import register
from sentry.options.manager import (
    FLAG_ADMIN_MODIFIABLE,
    FLAG_ALLOW_EMPTY,
    FLAG_AUTOMATOR_MODIFIABLE,
    FLAG_BOOL,
    FLAG_CREDENTIAL,
    FLAG_IMMUTABLE,
    FLAG_MODIFIABLE_BOOL,
    FLAG_MODIFIABLE_RATE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_RATE,
    FLAG_REQUIRED,
    FLAG_SCALAR,
)
from sentry.utils.types import Any, Bool, Dict, Float, Int, Sequence, String

# Cache
# register('cache.backend', flags=FLAG_NOSTORE)
# register('cache.options', type=Dict, flags=FLAG_NOSTORE)


# System
register("system.admin-email", flags=FLAG_REQUIRED)
register(
    "system.support-email",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "system.security-email",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register("system.databases", type=Dict, flags=FLAG_NOSTORE)
# register('system.debug', default=False, flags=FLAG_NOSTORE)
register(
    "system.rate-limit",
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "system.event-retention-days",
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register("system.secret-key", flags=FLAG_CREDENTIAL | FLAG_NOSTORE)
register("system.root-api-key", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("system.logging-format", default=LoggingFormat.HUMAN, flags=FLAG_NOSTORE)
# This is used for the chunk upload endpoint
register("system.upload-url-prefix", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register(
    "system.maximum-file-size",
    default=2**31,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# URL configuration
# Absolute URL to the sentry root directory. Should not include a trailing slash.
register(
    "system.url-prefix",
    ttl=60,
    grace=3600,
    default=os.environ.get("SENTRY_SYSTEM_URL_PREFIX"),
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register(
    "system.internal-url-prefix",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
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

# See getsentry.processingstore
register("eventstore.processing.rollout", type=Float, default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Processing worker caches
register(
    "dsym.cache-path",
    type=String,
    default="/tmp/sentry-dsym-cache",
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "releasefile.cache-path",
    type=String,
    default="/tmp/sentry-releasefile-cache",
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "releasefile.cache-limit",
    type=Int,
    default=10 * 1024 * 1024,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)


# Mail
register("mail.backend", default="smtp", flags=FLAG_NOSTORE)
register(
    "mail.host",
    default="127.0.0.1",
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.port",
    default=25,
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.username",
    flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.password",
    flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.use-tls",
    default=False,
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.use-ssl",
    default=False,
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register(
    "mail.subject-prefix",
    default="[Sentry]",
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "mail.from",
    default="root@localhost",
    flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK,
)
register("mail.list-namespace", type=String, default="localhost", flags=FLAG_NOSTORE)
register(
    "mail.enable-replies", default=False, flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "mail.reply-hostname",
    default="",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "mail.mailgun-api-key",
    default="",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "mail.timeout",
    default=10,
    type=Int,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# TOTP (Auth app)
register(
    "totp.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# SMS
register(
    "sms.twilio-account",
    default="",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sms.twilio-token", default="", flags=FLAG_CREDENTIAL | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK
)
register(
    "sms.twilio-number",
    default="",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sms.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# U2F
register(
    "u2f.app-id",
    default="",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "u2f.facets",
    default=[],
    type=Sequence,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "u2f.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Recovery Codes
register(
    "recovery.disallow-new-enrollment",
    default=False,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Auth
register(
    "auth.ip-rate-limit",
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "auth.user-rate-limit",
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "auth.allow-registration",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_REQUIRED,
)

# API Tokens
register(
    "apitoken.auto-add-last-chars",
    default=True,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "api.rate-limit.org-create",
    default=5,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Beacon
register("beacon.anonymous", type=Bool, flags=FLAG_REQUIRED)
register(
    "beacon.record_cpu_ram_usage",
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_REQUIRED,
)

# Filestore (default)
register("filestore.backend", default="filesystem", flags=FLAG_NOSTORE)
register("filestore.options", default={"location": "/tmp/sentry-files"}, flags=FLAG_NOSTORE)
register(
    "filestore.relocation", default={"location": "/tmp/sentry-relocation-files"}, flags=FLAG_NOSTORE
)

# Filestore for control silo
register("filestore.control.backend", default="", flags=FLAG_NOSTORE)
register("filestore.control.options", default={}, flags=FLAG_NOSTORE)

# Throttle filestore access in proguard processing. This is in response to
# INC-635.
register(
    "filestore.proguard-throttle",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE | FLAG_MODIFIABLE_RATE,
)

# Whether to use a redis lock on fileblob uploads and deletes
register("fileblob.upload.use_lock", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE)
# Whether to use redis to cache `FileBlob.id` lookups
register("fileblob.upload.use_blobid_cache", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Symbol server
register(
    "symbolserver.enabled",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "symbolserver.options",
    default={"url": "http://127.0.0.1:3000"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Symbolicator
register(
    "symbolicator.enabled",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "symbolicator.options",
    default={"url": "http://127.0.0.1:3021"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitch for symbolication sources, based on a list of source IDs. Meant to be used in extreme
# situations where it is preferable to break symbolication in a few places as opposed to letting
# it break everywhere.
register(
    "symbolicator.ignored_sources",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# Backend chart rendering via chartcuterie
register(
    "chart-rendering.enabled",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "chart-rendering.chartcuterie",
    default={"url": "http://127.0.0.1:7901"},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Leaving these empty will use the same storage driver configured for
# Filestore
register(
    "chart-rendering.storage.backend",
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "chart-rendering.storage.options",
    type=Dict,
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Replay Options
#
# Replay storage backend configuration (only applicable if the direct-storage driver is used)
register(
    "replay.storage.backend",
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "replay.storage.options",
    type=Dict,
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Replay Analyzer service.
register(
    "replay.analyzer_service_url",
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "organizations:session-replay-accessibility-issues-enabled",
    type=Bool,
    default=True,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# User Feedback Options
register(
    "feedback.organizations.slug-denylist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# Analytics
register("analytics.backend", default="noop", flags=FLAG_NOSTORE)
register("analytics.options", default={}, flags=FLAG_NOSTORE)

# Slack Integration
register("slack.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("slack.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
# signing-secret is preferred, but need to keep verification-token for apps that use it
register("slack.verification-token", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("slack.signing-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# Codecov Integration
register("codecov.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# GitHub Integration
register("github-app.id", default=0, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("github-app.name", default="", flags=FLAG_AUTOMATOR_MODIFIABLE)
register("github-app.webhook-secret", default="", flags=FLAG_CREDENTIAL)
register("github-app.private-key", default="", flags=FLAG_CREDENTIAL)
register("github-app.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("github-app.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# GitHub Auth
register(
    "github-login.client-id", default="", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE
)
register("github-login.client-secret", default="", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register(
    "github-login.require-verified-email",
    type=Bool,
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "github-login.base-domain",
    default="github.com",
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "github-login.api-domain",
    default="api.github.com",
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "github-login.extended-permissions",
    type=Sequence,
    default=[],
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register("github-login.organization", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)

# VSTS Integration
register("vsts.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vsts.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
# VSTS Integration - with limited scopes
register("vsts-limited.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vsts-limited.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# PagerDuty Integration
register("pagerduty.app-id", default="", flags=FLAG_AUTOMATOR_MODIFIABLE)

# Vercel Integration
register("vercel.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vercel.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("vercel.integration-slug", default="sentry", flags=FLAG_AUTOMATOR_MODIFIABLE)

# MsTeams Integration
register("msteams.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("msteams.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("msteams.app-id")

# Discord Integration
register("discord.application-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("discord.public-key", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("discord.bot-token", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("discord.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# AWS Lambda Integration
register("aws-lambda.access-key-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("aws-lambda.secret-access-key", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)
register("aws-lambda.cloudformation-url", flags=FLAG_AUTOMATOR_MODIFIABLE)
register("aws-lambda.account-number", default="943013980633", flags=FLAG_AUTOMATOR_MODIFIABLE)
register(
    "aws-lambda.node.layer-name", default="SentryNodeServerlessSDK", flags=FLAG_AUTOMATOR_MODIFIABLE
)
register("aws-lambda.node.layer-version", flags=FLAG_AUTOMATOR_MODIFIABLE)
register(
    "aws-lambda.python.layer-name",
    default="SentryPythonServerlessSDK",
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register("aws-lambda.python.layer-version", flags=FLAG_AUTOMATOR_MODIFIABLE)
# the region of the host account we use for assuming the role
register("aws-lambda.host-region", default="us-east-2", flags=FLAG_AUTOMATOR_MODIFIABLE)
# the number of threads we should use to install Lambdas
register("aws-lambda.thread-count", default=100, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Snuba
register(
    "snuba.search.pre-snuba-candidates-optimizer",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "snuba.search.pre-snuba-candidates-percentage", default=0.2, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "snuba.search.project-group-count-cache-time",
    default=24 * 60 * 60,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register("snuba.search.min-pre-snuba-candidates", default=500, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.search.max-pre-snuba-candidates", default=5000, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.search.chunk-growth-rate", default=1.5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.search.max-chunk-size", default=2000, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.search.max-total-chunk-time-seconds", default=30.0, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.search.hits-sample-size", default=100, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("snuba.track-outcomes-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# The percentage of tagkeys that we want to cache. Set to 1.0 in order to cache everything, <=0.0 to stop caching
register(
    "snuba.tagstore.cache-tagkeys-rate",
    default=0.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Kafka Publisher
register("kafka-publisher.raw-event-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("kafka-publisher.max-event-size", default=100000, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Enable multiple topics for eventstream. It allows specific event types to be sent
# to specific topic.
register(
    "store.eventstream-per-type-topic",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# The fraction of prooguard events that will be routed to the
# separate `store.process_event_proguard` queue
register(
    "store.separate-proguard-queue-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE | FLAG_MODIFIABLE_RATE,
)

# Query and supply Bundle Indexes to Symbolicator SourceMap processing
register(
    "symbolicator.sourcemaps-bundle-index-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
# Refresh Bundle Indexes reported as used by symbolicator
register(
    "symbolicator.sourcemaps-bundle-index-refresh-sample-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Post Process Error Hook Sampling
register(
    "post-process.use-error-hook-sampling", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused
# From 0.0 to 1.0: Randomly enqueue process_resource_change task
register(
    "post-process.error-hook-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# Transaction events
# True => kill switch to disable ingestion of transaction events for internal project.
register(
    "transaction-events.force-disable-internal-project",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Moving signals and TSDB into outcomes consumer
register(
    "outcomes.signals-in-consumer-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused
register(
    "outcomes.tsdb-in-consumer-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# Node data save rate
register(
    "nodedata.cache-sample-rate",
    default=0.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "nodedata.cache-on-save", default=False, flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE
)

# Alerts / Workflow incremental rollout rate. Tied to feature handlers in getsentry
register("workflow.rollout-rate", default=0, flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)

# Performance metric alerts incremental rollout rate. Tied to feature handlers
# in getsentry
register(
    "incidents-performance.rollout-rate",
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Max number of tags to combine in a single query in Discover2 tags facet.
register(
    "discover2.max_tags_to_combine",
    default=3,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables setting a sampling rate when producing the tag facet.
register(
    "discover2.tags_facet_enable_sampling",
    default=True,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitch for datascrubbing after stacktrace processing. Set to False to
# disable datascrubbers.
register("processing.can-use-scrubbers", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Enable use of symbolic-sourcemapcache for JavaScript Source Maps processing.
# Set this value of the fraction of projects that you want to use it for.
register(
    "processing.sourcemapcache-processor", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# Killswitch for sending internal errors to the internal project or
# `SENTRY_SDK_CONFIG.relay_dsn`. Set to `0` to only send to
# `SENTRY_SDK_CONFIG.dsn` (the "upstream transport") and nothing else.
#
# Note: A value that is neither 0 nor 1 is regarded as 0
register("store.use-relay-dsn-sample-rate", default=1, flags=FLAG_AUTOMATOR_MODIFIABLE)

# A rate to apply to any events denoted as experimental to be sent to an experimental dsn.
register("store.use-experimental-dsn-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# A rate that enables statsd item sending (DDM data) to s4s
register("store.allow-s4s-ddm-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Mock out integrations and services for tests
register("mocks.jira", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Record statistics about event payloads and their compressibility
register(
    "store.nodestore-stats-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# Killswitch to stop storing any reprocessing payloads.
register("store.reprocessing-force-disable", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

register(
    "store.race-free-group-creation-force-disable", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Option to enable dart deobfuscation on ingest
register(
    "processing.view-hierarchies-dart-deobfuscation", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Enable calling the severity modeling API on group creation
register(
    "processing.calculate-severity-on-group-creation",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enable sending the flag to the microservice to tell it to purposefully take longer than our
# timeout, to see the effect on the overall error event processing backlog
register(
    "processing.severity-backlog-test.timeout",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enable sending the flag to the microservice to tell it to purposefully send back an error, to see
# the effect on the overall error event processing backlog
register(
    "processing.severity-backlog-test.error",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.high-priority-alerts-projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.new-escalation-projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.priority.projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)


# Killswitch for issue priority
register(
    "issues.priority.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.similarity-embeddings.projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# ## sentry.killswitches
#
# The following options are documented in sentry.killswitches in more detail
register(
    "store.load-shed-group-creation-projects", type=Any, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register("store.load-shed-pipeline-projects", type=Any, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
register(
    "store.load-shed-parsed-pipeline-projects",
    type=Any,
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "store.load-shed-save-event-projects", type=Any, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "store.load-shed-process-event-projects", type=Any, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "store.load-shed-process-event-projects-gradual",
    type=Dict,
    default={},
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Applies load shedding per project gradually. 1.0 means full load shedding
# 0.0 or no config means no load shedding.
register(
    "store.load-shed-symbolicate-event-projects",
    type=Any,
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "store.save-event-highcpu-platforms", type=Sequence, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "store.symbolicate-event-lpq-never", type=Sequence, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "store.symbolicate-event-lpq-always", type=Sequence, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "post_process.get-autoassign-owners", type=Sequence, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "api.organization.disable-last-deploys",
    type=Sequence,
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Switch for more performant project counter incr
register(
    "store.projectcounter-modern-upsert-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Run an experimental grouping config in background for performance analysis
register("store.background-grouping-config-id", default=None, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Fraction of events that will pass through background grouping
register("store.background-grouping-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Minimum number of files in an archive. Archives with fewer files are extracted and have their
# contents stored as separate release files.
register("processing.release-archive-min-files", default=10, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Whether to use `zstd` instead of `zlib` for the attachment cache.
register("attachment-cache.use-zstd", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Whether to use `zstd` instead of `zlib` for encoded grouping enhancers.
register("enhancers.use-zstd", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Set of projects that will always store `EventAttachment` blobs directly.
register("eventattachments.store-blobs.projects", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
# Percentage sample rate for `EventAttachment`s that should use direct blob storage.
register("eventattachments.store-blobs.sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# All Relay options (statically authenticated Relays can be registered here)
register("relay.static_auth", default={}, flags=FLAG_NOSTORE)

# Tell Relay to stop extracting metrics from transaction payloads (see killswitches)
# Example value: [{"project_id": 42}, {"project_id": 123}]
register("relay.drop-transaction-metrics", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# [Unused] Sample rate for opting in orgs into transaction metrics extraction.
register("relay.transaction-metrics-org-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Relay should emit a usage metric to track total spans.
register("relay.span-usage-metric", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Killswitch for the Relay cardinality limiter, one of `enabled`, `disabled`, `passive`.
# In `passive` mode Relay's cardinality limiter is active but it does not enforce the limits.
#
# Note: To fully enable the cardinality limiter the feature `organizations:relay-cardinality-limiter`
# needs to be rolled out as well.
register("relay.cardinality-limiter.mode", default="enabled", flags=FLAG_AUTOMATOR_MODIFIABLE)
# Override to set a list of limits into passive mode by organization.
#
# In passive mode Relay's cardinality limiter is active but it does not enforce the limits.
#
# Example: `{1: ["transactions"]}`
# Forces the `transactions` cardinality limit into passive mode for the organization with id `1` (Sentry).
register(
    "relay.cardinality-limiter.passive-limits-by-org", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE
)
# Sample rate for Cardinality Limiter Sentry errors.
#
# Rate needs to be between `0.0` and `1.0`.
# If set to `1.0` all cardinality limiter rejections will be logged as a Sentry error.
register(
    "relay.cardinality-limiter.error-sample-rate", default=0.01, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Controls the encoding used in Relay for encoding distributions and sets
# when writing to Kafka.
#
# Key is the metric namespace (as used by Relay) and the value is the desired encoding.
register("relay.metric-bucket-encodings", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Write new kafka headers in eventstream
register("eventstream:kafka-headers", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Post process forwarder options
# Gets data from Kafka headers
register("post-process-forwarder:kafka-headers", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Subscription queries sampling rate
register("subscriptions-query.sample-rate", default=0.01, flags=FLAG_AUTOMATOR_MODIFIABLE)

# The ratio of symbolication requests for which metrics will be submitted to redis.
#
# This is to allow gradual rollout of metrics collection for symbolication requests and can be
# removed once it is fully rolled out.
register(
    "symbolicate-event.low-priority.metrics.submission-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Sampling rate for controlled rollout of a change where ignest-consumer spawns
# special save_event task for transactions avoiding the preprocess.
register(
    "store.save-transactions-ingest-consumer-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Drop delete_old_primary_hash messages for a particular project.
register("reprocessing2.drop-delete-old-primary-hash", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# Switch to use service wrapper for reprocessing redis operations
register("reprocessing.use_store", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# BEGIN ABUSE QUOTAS

# Example:
# >>> org = Organization.objects.get(slug='foo')
# >>> org.update_option("project-abuse-quota.transaction-limit", 42)
# >>> for q in SubscriptionQuota()._get_abuse_quotas(org): print(q.to_json())
# {'id': 'pat', 'scope': 'project', 'categories': ['transaction'], 'limit': 420, 'window': 10, 'reasonCode': 'project_abuse_limit'}
# You can see that for this organization, 42 transactions per second
# is effectively enforced as 420/s because the rate limiting window is 10 seconds.

# DEPRECATED (only in use by getsentry).
# Use "project-abuse-quota.window" instead.
register(
    "getsentry.rate-limit.window",
    type=Int,
    default=10,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Relay isn't effective at enforcing 1s windows - 10 seconds has worked well.
# If the limit is negative, then it means completely blocked.
# I don't see this value needing to be tweaked on a per-org basis,
# so for now the org option "project-abuse-quota.window" doesn't do anything.
register(
    "project-abuse-quota.window",
    type=Int,
    default=10,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# DEPRECATED. Use "project-abuse-quota.error-limit" instead.
# This is set to 0: don't limit by default, because it is configured in production.
# The DEPRECATED org option override is "sentry:project-error-limit".
register(
    "getsentry.rate-limit.project-errors",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# DEPRECATED. Use "project-abuse-quota.transaction-limit" instead.
# This is set to 0: don't limit by default, because it is configured in production.
# The DEPRECATED org option override is "sentry:project-transaction-limit".
register(
    "getsentry.rate-limit.project-transactions",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# These are set to 0: don't limit by default.
# These have yet to be configured in production.
# For errors and transactions, the above DEPRECATED options take
# precedence for now, until we decide on values to set for all these.
# Set the same key as an org option which will override these values for the org.
# Similarly, for now, the DEPRECATED org options "sentry:project-error-limit"
# and "sentry:project-transaction-limit" take precedence.
register(
    "project-abuse-quota.error-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "project-abuse-quota.transaction-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "project-abuse-quota.attachment-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "project-abuse-quota.session-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)


register(
    "organization-abuse-quota.metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)


register(
    "global-abuse-quota.metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "global-abuse-quota.sessions-metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "global-abuse-quota.transactions-metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "global-abuse-quota.spans-metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "global-abuse-quota.custom-metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# END ABUSE QUOTAS

# Send event messages for specific project IDs to random partitions in Kafka
# contents are a list of project IDs to message types to be randomly assigned
# e.g. [{"project_id": 2, "message_type": "error"}, {"project_id": 3, "message_type": "transaction"}]
register(
    "kafka.send-project-events-to-random-partitions", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Rate to project_configs_v3, no longer used.
register("relay.project-config-v3-enable", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# [Unused] Use zstandard compression in redis project config cache
# Set this value to a list of DSNs.
register(
    "relay.project-config-cache-compress", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# [Unused] Use zstandard compression in redis project config cache
# Set this value of the fraction of config writes you want to compress.
register(
    "relay.project-config-cache-compress-sample-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)  # unused

# default brownout crontab for api deprecations
register(
    "api.deprecation.brownout-cron",
    default="0 12 * * *",
    type=String,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Brownout duration to be stored in ISO8601 format for durations (See https://en.wikipedia.org/wiki/ISO_8601#Durations)
register("api.deprecation.brownout-duration", default="PT1M", flags=FLAG_AUTOMATOR_MODIFIABLE)

# Option to disable misbehaving use case IDs
register("sentry-metrics.indexer.disabled-namespaces", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# A slow rollout option for writing "new" cache keys
# as the transition from UseCaseKey to UseCaseID occurs
register(
    "sentry-metrics.indexer.cache-key-rollout-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# A option for double writing old and new cache keys
# for the same transition
register(
    "sentry-metrics.indexer.cache-key-double-write", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# An option to tune the percentage of cache keys that gets replenished during indexer resolve
register(
    "sentry-metrics.indexer.disable-memcache-replenish-rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# An option to enable reading from the new schema for the caching indexer
register(
    "sentry-metrics.indexer.read-new-cache-namespace",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# An option to enable writing from the new schema for the caching indexer
register(
    "sentry-metrics.indexer.write-new-cache-namespace",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Option to control sampling percentage of schema validation on the generic metrics pipeline
# based on namespace.
register(
    "sentry-metrics.indexer.generic-metrics.schema-validation-rules",
    default={},  # empty dict means validate schema for all use cases
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Option to control sampling percentage of schema validation on the release health metrics
# pipeline based on namespace.
register(
    "sentry-metrics.indexer.release-health.schema-validation-rules",
    default={},  # empty dict means validate schema for all use cases
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Option to control whether or not we raise ValidationErrors in the indexer
# (Temporary) raising the error would mean we skip the processing or DLQing of these
# invalid messages
register(
    "sentry-metrics.indexer.raise-validation-errors",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

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
register(
    "sentry-metrics.writes-limiter.limits.performance.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.transactions.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.sessions.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.spans.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.releasehealth.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.custom.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.generic-metrics.per-org",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry-metrics.writes-limiter.limits.performance.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.transactions.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.sessions.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.spans.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.releasehealth.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.custom.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.writes-limiter.limits.generic-metrics.global",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry-metrics.writes-limiter.apply-uca-limiting",
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
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
register(
    "sentry-metrics.cardinality-limiter.limits.performance.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.transactions.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.sessions.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.spans.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.custom.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.profiles.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.limits.generic-metrics.per-org",
    default=[
        {"window_seconds": 3600, "granularity_seconds": 600, "limit": 10000},
    ],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter.orgs-rollout-rate",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.10s-granularity",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry-metrics.producer-schema-validation.release-health.rollout-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "sentry-metrics.producer-schema-validation.performance.rollout-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Flag to determine whether abnormal_mechanism tag should be extracted
register(
    "sentry-metrics.releasehealth.abnormal-mechanism-extraction-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry-metrics.synchronize-kafka-rebalances",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry-metrics.synchronized-rebalance-delay",
    default=15,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Performance issue option for *all* performance issues detection
register("performance.issues.all.problem-detection", default=1.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Individual system-wide options in case we need to turn off specific detectors for load concerns, ignoring the set project options.
register(
    "performance.issues.compressed_assets.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.compressed_assets.la-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.compressed_assets.ea-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.compressed_assets.ga-rollout", default=1.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.consecutive_db.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.consecutive_db.la-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.consecutive_db.ea-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.consecutive_db.ga-rollout", default=1.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.n_plus_one_db.problem-detection",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_db.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_db_ext.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.file_io_main_thread.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.db_main_thread.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_api_calls.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_api_calls.la-rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_api_calls.ea-rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.n_plus_one_api_calls.ga-rollout",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.slow_db_query.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.slow_db_query.la-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.slow_db_query.ea-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.slow_db_query.ga-rollout", default=1.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.render_blocking_assets.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.la-rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.ea-rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.ga-rollout",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.m_n_plus_one_db.problem-creation",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.m_n_plus_one_db.la-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.m_n_plus_one_db.ea-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.m_n_plus_one_db.ga-rollout", default=1.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.http_overhead.problem-creation",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.http_overhead.la-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.http_overhead.ea-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.http_overhead.ga-rollout", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# System-wide options for default performance detection settings for any org opted into the performance-issues-ingest feature. Meant for rollout.
register(
    "performance.issues.n_plus_one_db.count_threshold", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "performance.issues.n_plus_one_db.duration_threshold",
    default=50.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.slow_db_query.duration_threshold",
    default=500.0,  # ms
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.fcp_minimum_threshold",
    default=2000.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.fcp_maximum_threshold",
    default=10000.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.fcp_ratio_threshold",
    default=0.33,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.render_blocking_assets.size_threshold",
    default=500000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.consecutive_http.max_duration_between_spans",
    default=500,  # ms
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.consecutive_http.consecutive_count_threshold",
    default=3,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.consecutive_http.span_duration_threshold",
    default=500,  # ms
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.consecutive_http.min_time_saved_threshold",
    default=2000,  # ms
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.issues.large_http_payload.size_threshold",
    default=300000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # 1MB
register(
    "performance.issues.db_on_main_thread.total_spans_duration_threshold",
    default=16,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms
register(
    "performance.issues.file_io_on_main_thread.total_spans_duration_threshold",
    default=16,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms
register(
    "performance.issues.uncompressed_asset.size_threshold",
    default=500 * 1024,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # 512 kilo bytes
register(
    "performance.issues.uncompressed_asset.duration_threshold",
    default=300,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms
register(
    "performance.issues.consecutive_db.min_time_saved_threshold",
    default=100,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms
register(
    "performance.issues.http_overhead.http_request_delay_threshold",
    default=500,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms
register(
    "performance.issues.n_plus_one_api_calls.total_duration",
    default=300,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # ms

# Dynamic Sampling system-wide options
# Size of the sliding window used for dynamic sampling. It is defaulted to 24 hours.
register("dynamic-sampling:sliding_window.size", default=24, flags=FLAG_AUTOMATOR_MODIFIABLE)
# Number of large transactions to retrieve from Snuba for transaction re-balancing.
register(
    "dynamic-sampling.prioritise_transactions.num_explicit_large_transactions",
    30,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Number of large transactions to retrieve from Snuba for transaction re-balancing.
register(
    "dynamic-sampling.prioritise_transactions.num_explicit_small_transactions",
    0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Controls the intensity of dynamic sampling transaction rebalancing. 0.0 = explict rebalancing
# not performed, 1.0= full rebalancing (tries to bring everything to mean). Note that even at 0.0
# there will still be some rebalancing between the explicit and implicit transactions ( so setting rebalancing
# to 0.0 is not the same as no rebalancing. To effectively disable rebalancing set the number of explicit
# transactions to be rebalance (both small and large) to 0.
register(
    "dynamic-sampling.prioritise_transactions.rebalance_intensity",
    default=0.8,
    flags=FLAG_MODIFIABLE_RATE | FLAG_AUTOMATOR_MODIFIABLE,
)

# === Hybrid cloud subsystem options ===
# UI rollout
register("hybrid_cloud.multi-region-selector", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybrid_cloud.region-domain-allow-list", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybrid_cloud.region-user-allow-list", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

register(
    "hybrid_cloud.use_region_specific_upload_url", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
)

# Retry controls
register("hybridcloud.regionsiloclient.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.rpc.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.integrationproxy.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Break glass controls
register("hybrid_cloud.rpc.disabled-service-methods", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
# == End hybrid cloud subsystem

# Decides whether an incoming transaction triggers an update of the clustering rule applied to it.
register("txnames.bump-lifetime-sample-rate", default=0.1, flags=FLAG_AUTOMATOR_MODIFIABLE)
# Decides whether an incoming span triggers an update of the clustering rule applied to it.
register("span_descs.bump-lifetime-sample-rate", default=0.25, flags=FLAG_AUTOMATOR_MODIFIABLE)

# === Backpressure related runtime options ===

# Enables monitoring of services for backpressure management.
register("backpressure.monitoring.enabled", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)
# How often the monitor will check service health.
register("backpressure.monitoring.interval", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Enables checking consumer health for backpressure management.
register("backpressure.checking.enabled", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)
# How often a consumer will check for its health in a debounced fassion.
register("backpressure.checking.interval", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)


# How long a status is persisted, which means that updates to health status can be paused for that long before consumers will assume things are unhealthy
register("backpressure.status_ttl", default=60, flags=FLAG_AUTOMATOR_MODIFIABLE)

# The high-watermark levels per-service which will mark a service as unhealthy.
# This should mirror the `SENTRY_PROCESSING_SERVICES` setting.
register(
    "backpressure.high_watermarks.celery",
    default=0.5,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "backpressure.high_watermarks.attachments-store",
    default=0.8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "backpressure.high_watermarks.processing-store",
    default=0.8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "backpressure.high_watermarks.processing-locks",
    default=0.8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "backpressure.high_watermarks.post-process-locks",
    default=0.8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Control whether the artifact bundles assemble endpoint support the missing chunks check the enables the CLI to only
# upload missing chunks instead of the entire bundle again.
register(
    "sourcemaps.artifact_bundles.assemble_with_missing_chunks",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitch for monitor check-ins
register("crons.organization.disable-check-in", type=Sequence, default=[])

# Turns on and off the running for dynamic sampling collect_orgs.
register("dynamic-sampling.tasks.collect_orgs", default=False, flags=FLAG_MODIFIABLE_BOOL)

# Sets the timeout for webhooks
register(
    "sentry-apps.webhook.timeout.sec",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# The flag activates whether to send group attributes messages to kafka
register(
    "issues.group_attributes.send_kafka",
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables statistical detectors for a project
register(
    "statistical_detectors.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "statistical_detectors.enable.projects.performance",
    type=Sequence,
    default=[],
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "statistical_detectors.enable.projects.profiling",
    type=Sequence,
    default=[],
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "statistical_detectors.query.batch_size",
    type=Int,
    default=100,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "statistical_detectors.query.transactions.timeseries_days",
    type=Int,
    default=14,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "statistical_detectors.ratelimit.ema",
    type=Int,
    default=-1,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "options_automator_slack_webhook_enabled",
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "on_demand.max_alert_specs",
    default=50,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "on_demand.max_widget_specs",
    default=100,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Some organizations can have more widget specs on a case-by-case basis. Widgets using this limit
# are listed in 'extended_widget_spec_orgs' option.
register("on_demand.extended_max_widget_specs", default=750, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("on_demand.extended_widget_spec_orgs", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
register(
    "on_demand.max_widget_cardinality.count",
    default=10000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "on_demand.max_widget_cardinality.on_query_count",
    default=50,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "on_demand.max_widget_cardinality.killswitch",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Overrides modified date and always updates the row. Can be removed if not needed later.
register(
    "on_demand.update_on_demand_modified",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.minimetrics_sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.enable_envelope_forwarding",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.enable_envelope_serialization",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.enable_capture_envelope",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.enable_common_tags",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.allow_all_incr",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.allow_all_timing",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.allow_all_gauge",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.emit_gauges",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.enable_code_locations",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "delightful_metrics.metrics_summary_sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# SDK Crash Detection
#
# The project ID belongs to the sentry organization: https://sentry.sentry.io/projects/cocoa-sdk-crashes/?project=4505469596663808.
register(
    "issues.sdk_crash_detection.cocoa.project_id",
    default=4505469596663808,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.cocoa.sample_rate",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# The project ID belongs to the sentry organization: https://sentry.sentry.io/projects/cocoa-sdk-crashes/?project=4506155486085120.
register(
    "issues.sdk_crash_detection.react-native.project_id",
    default=4506155486085120,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# The allowlist of org IDs that the react-native crash detection is enabled for.
register(
    "issues.sdk_crash_detection.react-native.organization_allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.react-native.sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.java.project_id",
    default=0,
    type=Int,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# The allowlist of org IDs that the java crash detection is enabled for.
register(
    "issues.sdk_crash_detection.java.organization_allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.java.sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# END: SDK Crash Detection

register(
    # Lists the shared resource ids we want to account usage for.
    "shared_resources_accounting_enabled",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "releases_v2.single-tenant",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# The flag disables the file io on main thread detector
register(
    "performance_issues.file_io_main_thread.disabled",
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables on-demand metric extraction for Dashboard Widgets.
register(
    "on_demand_metrics.check_widgets.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Rollout % for easing out rollout based on the dashboard widget query id
register(
    "on_demand_metrics.check_widgets.rollout",
    default=0.0,
    type=Float,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Number of DashboardWidgetQuery to be checked at once.
register(
    "on_demand_metrics.check_widgets.query.batch_size",
    type=Int,
    default=50,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Number of chunks to split queries across.
register(
    "on_demand_metrics.check_widgets.query.total_batches",
    default=100,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Use database backed stateful extraction state
register(
    "on_demand_metrics.widgets.use_stateful_extraction",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: whether or not the self-serve API for the feature is enabled. When set on a region
# silo, this flag controls whether or not that region's API will serve relocation requests to
# non-superuser clients. When set on the control silo, it can be used to regulate whether or not
# certain global UI (ex: the relocation creation form at `/relocation/`) is visible to users.
register(
    "relocation.enabled",
    default=False,
    flags=FLAG_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: populates the target region drop down in the control silo. Note: this option has NO
# EFFECT in region silos. However, the control silos `relocation.selectable-regions` array should be
# a complete list of all regions where `relocation.enabled`. If a region is enabled/disabled, it
# should also be added to/removed from this array in the control silo at the same time.
register(
    "relocation.selectable-regions",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: the step at which new relocations should be autopaused, requiring admin approval
# before continuing.
register(
    "relocation.autopause",
    default="",
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: globally limits the number of small (<=10MB) relocations allowed per silo per day.
register(
    "relocation.daily-limit.small",
    default=0,
    flags=FLAG_SCALAR | FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: globally limits the number of medium (>10MB && <=100MB) relocations allowed per silo
# per day.
register(
    "relocation.daily-limit.medium",
    default=0,
    flags=FLAG_SCALAR | FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: globally limits the number of large (>100MB) relocations allowed per silo per day.
register(
    "relocation.daily-limit.large",
    default=0,
    flags=FLAG_SCALAR | FLAG_AUTOMATOR_MODIFIABLE,
)

# max number of profiles to use for computing
# the aggregated flamegraph.
register(
    "profiling.flamegraph.profile-set.size",
    type=Int,
    default=100,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# org IDs for which we want to avoid using the unsampled profiles for function metrics.
# This will let us selectively disable the behaviour for entire orgs that may have an
# extremely high volume increase
register(
    "profiling.profile_metrics.unsampled_profiles.excluded_org_ids",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# project IDs for which we want to avoid using the unsampled profiles for function metrics.
# This will let us selectively disable the behaviour for project that may have an extremely
# high volume increase
register(
    "profiling.profile_metrics.unsampled_profiles.excluded_project_ids",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# list of platform names for which we allow using unsampled profiles for the purpose
# of improving profile (function) metrics
register(
    "profiling.profile_metrics.unsampled_profiles.platforms",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# sample rate for tuning the amount of unsampled profiles that we "let through"
register(
    "profiling.profile_metrics.unsampled_profiles.sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# killswitch for profile metrics
register(
    "profiling.profile_metrics.unsampled_profiles.enabled",
    default=False,
    type=Bool,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enable sending a post update signal after we update groups using a queryset update
register(
    "groups.enable-post-update-signal",
    default=False,
    flags=FLAG_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Sampling rates for testing Rust-based grouping enhancers

# Rate at which to parse enhancers in Rust in addition to Python
register(
    "grouping.rust_enhancers.parse_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Rate at which to run the Rust implementation of `apply_modifications_to_frames`
# and compare the results
register(
    "grouping.rust_enhancers.modify_frames_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Rate at which to prefer the `apply_modifications_to_frames` result of the Rust implementation.
register(
    "grouping.rust_enhancers.prefer_rust_result",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Rate to move from outbox based webhook delivery to webhookpayload.
register(
    "hybridcloud.webhookpayload.rollout",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "metrics.sample-list.sample-rate",
    type=Float,
    default=100_000.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Rates controlling the rollout of grouping parameterization experiments
register(
    "grouping.experiments.parameterization.uniq_id",
    default=0.0,
    flags=FLAG_ADMIN_MODIFIABLE | FLAG_AUTOMATOR_MODIFIABLE | FLAG_RATE,
)
register(
    "grouping.experiments.parameterization.json_str_val",
    default=0.0,
    flags=FLAG_ADMIN_MODIFIABLE | FLAG_AUTOMATOR_MODIFIABLE | FLAG_RATE,
)

# Sample rate for double writing to experimental dsn
register(
    "store.experimental-dsn-double-write.sample-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# killswitch for profiling ddm functions metrics.
# Enable/Disable the ingestion of function metrics
# in the generic metrics platform
register(
    "profiling.generic_metrics.functions_ingestion.enabled",
    default=False,
    type=Bool,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# list of org IDs for which we'll write the function
# metrics to the generic metrics platform
register(
    "profiling.generic_metrics.functions_ingestion.allowed_org_ids",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
