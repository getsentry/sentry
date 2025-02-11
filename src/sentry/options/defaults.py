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
from sentry.quotas.base import build_metric_abuse_quotas
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
# Enable date-util parsing for timestamps
register(
    "system.use-date-util-timestamps",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
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

# User Settings
register(
    "user-settings.signed-url-confirmation-emails-salt",
    type=String,
    default="signed-url-confirmation-emails-salt",
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "user-settings.signed-url-confirmation-emails",
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Staff
register(
    "staff.ga-rollout",
    type=Bool,
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "staff.user-email-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
# Superuser read/write
register(
    "superuser.read-write.ga-rollout",
    type=Bool,
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# API Tokens
register(
    "apitoken.auto-add-last-chars",
    default=True,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "apitoken.save-hash-on-create",
    default=True,
    type=Bool,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Controls the rate of using the hashed value of User API tokens for lookups when logging in
# and also updates tokens which are not hashed
register(
    "apitoken.use-and-update-hash-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
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
register("filestore.relocation-backend", default="filesystem", flags=FLAG_NOSTORE)
register(
    "filestore.relocation-options",
    default={"location": "/tmp/sentry-relocation-files"},
    flags=FLAG_NOSTORE,
)

# Filestore for control silo
register("filestore.control.backend", default="", flags=FLAG_NOSTORE)
register("filestore.control.options", default={}, flags=FLAG_NOSTORE)

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

# Configuration Options
register(
    "configurations.storage.backend",
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "configurations.storage.options",
    type=Dict,
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Flag Options
register(
    "flags:options-audit-log-is-enabled",
    default=True,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
    type=Bool,
)
register(
    "flags:options-audit-log-organization-id",
    default=None,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
    type=Int,
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
# Globally disables replay-video.
register(
    "replay.replay-video.disabled",
    type=Bool,
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Billing skip for mobile replay orgs.
register(
    "replay.replay-video.billing-skip-org-ids",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Disables replay-video for a specific organization.
register(
    "replay.replay-video.slug-denylist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
# Used for internal dogfooding of a reduced timeout on rage/dead clicks.
register(
    "replay.rage-click.experimental-timeout.org-id-list",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "replay.rage-click.experimental-timeout.milliseconds",
    type=Int,
    default=5000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Disables viewed by queries for a list of project ids.
register(
    "replay.viewed-by.project-denylist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# User Feedback Options
register(
    "feedback.organizations.slug-denylist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "feedback.message.max-size",
    type=Int,
    default=4096,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# Dev Toolbar Options
register(
    "devtoolbar.analytics.enabled",
    type=Bool,
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Extract logs from breadcrumbs only for a random fraction of sent breadcrumbs.
#
# NOTE: Any value below 1.0 will break the product. Do not override in production.
register(
    "relay.ourlogs-breadcrumb-extraction.sample-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Control number of breadcrumbs converted to OurLogs
register(
    "relay.ourlogs-breadcrumb-extraction.max-breadcrumbs-converted",
    default=100,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Extract spans only from a random fraction of transactions.
#
# NOTE: Any value below 1.0 will break the product. Do not override in production.
register(
    "relay.span-extraction.sample-rate",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Allow the Relay to skip normalization of spans for certain hosts.
register(
    "relay.span-normalization.allowed_hosts",
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# Drop attachments in transaction envelopes in Relay.
register(
    "relay.drop-transaction-attachments",
    type=Bool,
    default=False,
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

# Github Enterprise Integration
register(
    "github-enterprise-app.alert-rule-action",
    type=Bool,
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "github-enterprise-app.allowed-hosts-legacy-webhooks",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

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
register(
    "github-extension.enabled",
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "github-extension.enabled-orgs",
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# VSTS Integration
register("vsts.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vsts.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# New VSTS Integration
register("vsts_new.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vsts_new.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# VSTS Integration - with limited scopes
register("vsts-limited.client-id", flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE)
register("vsts-limited.client-secret", flags=FLAG_CREDENTIAL | FLAG_PRIORITIZE_DISK)

# Azure DevOps Integration Social Login Flow
register(
    "vsts.social-auth-migration",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

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

# Enable multiple topics for eventstream. It allows specific event types to be sent
# to specific topic.
register(
    "store.eventstream-per-type-topic",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
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

# Transaction events
# True => kill switch to disable ingestion of transaction events for internal project.
register(
    "transaction-events.force-disable-internal-project",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables setting a sampling rate when producing the tag facet.
register(
    "discover2.tags_facet_enable_sampling",
    default=True,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

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
    "issues.severity.first-event-severity-calculation-projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.seer-project-rate-limit",
    type=Any,
    default={"limit": 5, "window": 1},
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.seer-global-rate-limit",
    type=Any,
    default={"limit": 20, "window": 1},
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.seer-circuit-breaker-passthrough-limit",
    type=Dict,
    default={"limit": 1, "window": 10},
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.severity.seer-timout",
    type=Float,
    default=0.2,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.priority.projects-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)


#  Percentage of orgs that will be put into a bucket using the split rate below.
register(
    "issues.details.streamline-experiment-rollout-rate",
    type=Float,
    default=0.0,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# 50% of orgs will only see the Streamline UI, 50% will only see the Legacy UI.
register(
    "issues.details.streamline-experiment-split-rate",
    type=Float,
    default=0.5,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)


# Killswitch for issue priority
register(
    "issues.priority.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitch for all Seer services
#
# TODO: So far this is only being checked when calling the Seer similar issues service during
# ingestion
register(
    "seer.global-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitches for individual Seer services
#
# TODO: Most of these are not yet being used. The one current exception is the similarity service
# killswitch, which is checked before calling Seer when potentially creating a  new group as part of
# ingestion.
register(
    "seer.similarity-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity-backfill-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity-embeddings-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity-embeddings-grouping-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity-embeddings-delete-by-hash-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity.grouping_killswitch_projects",
    default=[],
    type=Sequence,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.severity-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.breakpoint-detection-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.autofix-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.anomaly-detection-killswitch.enabled",
    default=False,
    type=Bool,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "seer.similarity.global-rate-limit",
    type=Dict,
    default={"limit": 20, "window": 1},  # window is in seconds
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "seer.similarity.per-project-rate-limit",
    type=Dict,
    default={"limit": 5, "window": 1},  # window is in seconds
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "seer.similarity.circuit-breaker-config",
    type=Dict,
    default={
        "error_limit": 33250,
        "error_limit_window": 600,  # 10 min
        "broken_state_duration": 300,  # 5 min
    },
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "seer.similarity.ingest.use_reranking",
    type=Bool,
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "seer.similarity.similar_issues.use_reranking",
    type=Bool,
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# TODO: Once Seer grouping is GA-ed, we probably either want to turn this down or get rid of it in
# favor of the default 10% sample rate
register(
    "seer.similarity.metrics_sample_rate",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# seer nearest neighbour endpoint timeout
register(
    "embeddings-grouping.seer.nearest-neighbour-timeout",
    type=Float,
    default=0.1,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# seer embeddings record update endpoint timeout
register(
    "embeddings-grouping.seer.embeddings-record-update-timeout",
    type=Float,
    default=0.05,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# seer embeddings record delete endpoint timeout
register(
    "embeddings-grouping.seer.embeddings-record-delete-timeout",
    type=Float,
    default=0.1,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# seer embeddings ratelimit in percentage that is allowed
register(
    "embeddings-grouping.seer.ratelimit",
    type=Int,
    default=0,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# seer embeddings backfill batch size
register(
    "embeddings-grouping.seer.backfill-batch-size",
    type=Int,
    default=10,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "embeddings-grouping.seer.delete-record-batch-size",
    type=Int,
    default=100,
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
    "post_process.get-autoassign-owners", type=Sequence, default=[], flags=FLAG_AUTOMATOR_MODIFIABLE
)
register(
    "api.organization.disable-last-deploys",
    type=Sequence,
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "issues.severity.skip-seer-requests",
    type=Sequence,
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Switch for new logic for release health metrics, based on filtering on org & project ids
register(
    "release-health.use-org-and-project-filter",
    type=Bool,
    default=False,
    flags=FLAG_MODIFIABLE_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
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

# All Relay options (statically authenticated Relays can be registered here)
register("relay.static_auth", default={}, flags=FLAG_NOSTORE)

# Tell Relay to stop extracting metrics from transaction payloads (see killswitches)
# Example value: [{"project_id": 42}, {"project_id": 123}]
register("relay.drop-transaction-metrics", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# Relay should emit a usage metric to track total spans.
register("relay.span-usage-metric", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Killswitch for the Relay cardinality limiter, one of `enabled`, `disabled`, `passive`.
# In `passive` mode Relay's cardinality limiter is active but it does not enforce the limits.
register("relay.cardinality-limiter.mode", default="enabled", flags=FLAG_AUTOMATOR_MODIFIABLE)
# Override to set a list of limits into passive mode by organization.
#
# In passive mode Relay's cardinality limiter is active but it does not enforce the limits.
#
# Example: `{'1': ["transactions"]}`
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
# List of additional cardinality limits and selectors.
#
# ```
# {
#   "rollout_rate": 0.001,
#   "limit": { .. Cardinality Limit .. }
# }
# ```
register("relay.cardinality-limiter.limits", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# Controls the encoding used in Relay for encoding distributions and sets
# when writing to Kafka.
#
# Key is the metric namespace (as used by Relay) and the value is the desired encoding.
register("relay.metric-bucket-set-encodings", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("relay.metric-bucket-distribution-encodings", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Controls the rollout rate in percent (`0.0` to `1.0`) for metric stats.
register("relay.metric-stats.rollout-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Controls whether generic inbound filters are sent to Relay.
register("relay.emit-generic-inbound-filters", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

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

# The ratio of events for which we emit verbose apple symbol stats.
#
# This is to allow collecting more information on why symx is not performing as it should.
register("symbolicate.symx-logging-rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# The list of specific os_name+os_version for which we log extra infromation.
#
# This is done since SYMX is not performing bad across the board but rather only in specific case (what we are interested in).
register("symbolicate.symx-os-description-list", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# Drop delete_old_primary_hash messages for a particular project.
register("reprocessing2.drop-delete-old-primary-hash", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)

# The poll limit for the tempest service.
#
# 348 every 5 min ~ 100k per day
register("tempest.poll-limit", default=348, flags=FLAG_AUTOMATOR_MODIFIABLE)

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
    "project-abuse-quota.attachment-item-limit",
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
    "project-abuse-quota.span-limit",
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
    "organization-abuse-quota.custom-metric-bucket-limit",
    type=Int,
    default=0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)


for mabq in build_metric_abuse_quotas():
    register(
        mabq.option,
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

# Option to enable orjson for JSON parsing in reconstruct_messages function
register(
    "sentry-metrics.indexer.reconstruct.enable-orjson", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
)


# Option to remove support for percentiles on a per-use case basis.
# Add the use case name (e.g. "custom") to this list
# to disable percentiles storage for the use case
register(
    "sentry-metrics.drop-percentiles.per-use-case",
    default=[],
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
    "sentry-metrics.10s-granularity",
    default=False,
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

# Adjusting some time buffers in the trace endpoint
register(
    "performance.traces.transaction_query_timebuffer_days",
    type=Float,
    default=1.5,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # days
register(
    "performance.traces.span_query_timebuffer_hours",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)  # hours
register(
    "performance.traces.query_timestamp_projects",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-buffer-hours",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-max-trace-ids-per-chunk",
    type=Int,
    default=2500,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-skip-floating-spans",
    type=Bool,
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-scan-max-block-size-hours",
    type=Int,
    default=8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-scan-max-batches",
    type=Int,
    default=7,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-scan-max-execution-seconds",
    type=Int,
    default=30,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-scan-max-parallel-queries",
    type=Int,
    default=3,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.trace-explorer-skip-recent-seconds",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.span_query_minimum_spans",
    type=Int,
    default=10000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.traces.check_span_extraction_date",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    # the timestamp that spans extraction was enabled for this environment
    "performance.traces.spans_extraction_date",
    type=Int,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "insights.span-samples-query.sample-rate",
    type=Float,
    default=0.0,  # 0 acts as 'no sampling'
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "performance.spans-tags-key.sample-rate",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.spans-tags-key.max",
    type=Int,
    default=1000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.spans-tags-value.sample-rate",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "performance.spans-tags-values.max",
    type=Int,
    default=1000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# In Single Tenant with 100% DS, we may need to reverse the UI change made by dynamic-sampling
# if metrics extraction isn't ready.
register("performance.hide-metrics-ui", type=Bool, default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Used for enabling flags in ST. Should be removed once Flagpole works in all STs.
register(
    "performance.use_metrics.orgs_allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
# Used for the z-score when calculating the margin of error in performance
register(
    "performance.extrapolation.confidence.z-score",
    type=Float,
    default=1.96,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
# Used for enabling flags in ST. Should be removed once Flagpole works in all STs.
register("performance.use_metrics.enabled", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

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

# Stops dynamic sampling rules from being emitted in relay config.
# This is required for ST instances that have flakey flags as we want to be able kill DS ruining customer data if necessary.
# It is only a killswitch for behaviour, it may actually increase infra load if flipped for a user currently being sampled.
register("dynamic-sampling.config.killswitch", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

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

# Enables a feature flag check in dynamic sampling tasks that switches
# organizations between transactions and spans for rebalancing. This check is
# expensive, so it can be disabled using this option.
register(
    "dynamic-sampling.check_span_feature_flag",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE | FLAG_MODIFIABLE_RATE,
)

# === Hybrid cloud subsystem options ===
# UI rollout
register(
    "hybrid_cloud.disable_relative_upload_urls", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
)
register("hybrid_cloud.disable_tombstone_cleanup", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# List of event IDs to pass through
register(
    "hybrid_cloud.audit_log_event_id_invalid_pass_list",
    default=[],
    type=Sequence,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Flagpole Configuration (used in getsentry)
register("flagpole.debounce_reporting_seconds", default=0, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Feature flagging error capture rate.
# When feature flagging has faults, it can become very high volume and we can overwhelm sentry.
register("features.error.capture_rate", default=0.1, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Retry controls
register("hybridcloud.regionsiloclient.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.rpc.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.integrationproxy.retries", default=5, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.endpoint_flag_logging", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.rpc.method_retry_overrides", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)
register("hybridcloud.rpc.method_timeout_overrides", default={}, flags=FLAG_AUTOMATOR_MODIFIABLE)
# Webhook processing controls
register(
    "hybridcloud.webhookpayload.worker_threads",
    default=4,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Break glass controls
register("hybrid_cloud.rpc.disabled-service-methods", default=[], flags=FLAG_AUTOMATOR_MODIFIABLE)
# == End hybrid cloud subsystem

# Decides whether an incoming transaction triggers an update of the clustering rule applied to it.
register("txnames.bump-lifetime-sample-rate", default=0.1, flags=FLAG_AUTOMATOR_MODIFIABLE)

# === Nodestore related runtime options ===

register(
    "nodestore.set-subkeys.enable-set-cache-item", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE
)

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
register(
    "backpressure.high_watermarks.processing-store-transactions",
    default=0.8,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Killswitch for monitor check-ins
register("crons.organization.disable-check-in", type=Sequence, default=[])


# Temporary killswitch to enable dispatching incident occurrences into the
# incident_occurrence_consumer
register(
    "crons.dispatch_incident_occurrences_to_consumer",
    default=False,
    flags=FLAG_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables recording tick volume metrics and tick decisions based on those
# metrics. Decisions are used to delay notifications in a system incident.
register(
    "crons.system_incidents.collect_metrics",
    default=False,
    flags=FLAG_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# Enables the the crons incident occurrence consumer to consider the clock-tick
# decision made based on volume metrics to determine if a incident occurrence
# should be processed, delayed, or dropped entirely.
register(
    "crons.system_incidents.use_decisions",
    default=False,
    flags=FLAG_BOOL | FLAG_AUTOMATOR_MODIFIABLE,
)

# The threshold that the tick metric must surpass for a tick to be determined
# as anomalous. This value should be negative, since we will only determine an
# incident based on a decrease in volume.
#
# See the `monitors.system_incidents` module for more details
register(
    "crons.system_incidents.pct_deviation_anomaly_threshold",
    default=-10,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# The threshold that the tick metric must surpass to transition to an incident
# state. This should be a fairly high value to avoid false positive incidents.
register(
    "crons.system_incidents.pct_deviation_incident_threshold",
    default=-30,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# This is the number of previous ticks we will consider the tick metrics and
# tick decisions for to determine a decision about the tick being evaluated.
register(
    "crons.system_incidents.tick_decision_window",
    default=5,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)


# Sets the timeout for webhooks
register(
    "sentry-apps.webhook.timeout.sec",
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
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
    "statistical_detectors.query.functions.timeseries_days",
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
    "statistical_detectors.throughput.threshold.transactions",
    default=50,
    type=Int,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "statistical_detectors.throughput.threshold.functions",
    default=25,
    type=Int,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
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

register("metric_extraction.max_span_attribute_specs", default=100, flags=FLAG_AUTOMATOR_MODIFIABLE)

register(
    "delightful_metrics.minimetrics_sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# IDs of orgs that will stop ingesting custom metrics.
register(
    "custom-metrics-ingestion-disabled-orgs",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# IDs of projects that will stop ingesting custom metrics.
register(
    "custom-metrics-ingestion-disabled-projects",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# IDs of orgs that will be disabled from querying metrics via `/metrics/query` endpoint.
register(
    "custom-metrics-querying-disabled-orgs",
    default=[],
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

register(
    "issues.sdk_crash_detection.native.project_id",
    default=0,
    type=Int,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.native.organization_allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.native.sample_rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.dart.project_id",
    default=0,
    type=Int,
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.dart.organization_allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.sdk_crash_detection.dart.sample_rate",
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
# Use to rollout using a cache for should_use_on_demand function, which resolves queries
register(
    "on_demand_metrics.cache_should_use_on_demand",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE | FLAG_MODIFIABLE_RATE,
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
# DEPRECATED: will be removed after the new `relocation.autopause.*` options are fully rolled out.
register(
    "relocation.autopause",
    default="",
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: the step at which new `SELF_HOSTED` relocations should be autopaused, requiring an
# admin to unpause before continuing.
register(
    "relocation.autopause.self-hosted",
    default="",
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Relocation: the step at which new `SELF_HOSTED` relocations should be autopaused, requiring an
# admin to unpause before continuing.
register(
    "relocation.autopause.saas-to-saas",
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


# Switch to read assemble status from Redis instead of memcache
register("assemble.read_from_redis", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE)

# Sampling rates for testing Rust-based grouping enhancers

# Rate at which to run the Rust implementation of `assemble_stacktrace_component`
# and compare the results
register(
    "grouping.rust_enhancers.compare_components",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# Rate at which to prefer the Rust implementation of `assemble_stacktrace_component`.
register(
    "grouping.rust_enhancers.prefer_rust_components",
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

# TODO: For now, only a small number of projects are going through a grouping config transition at
# any given time, so we're sampling at 100% in order to be able to get good signal. Once we've fully
# transitioned to the optimized logic, and before the next config change, we probably either want to
# turn this down or get rid of it in favor of the default 10% sample rate
register(
    "grouping.config_transition.metrics_sample_rate",
    type=Float,
    default=1.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)


# Sample rate for double writing to experimental dsn
register(
    "store.experimental-dsn-double-write.sample-rate",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# temporary option for logging canonical key fallback stacktraces
register(
    "canonical-fallback.send-error-to-sentry",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Standalone spans
register(
    "standalone-spans.process-spans-consumer.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.process-spans-consumer.project-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.process-spans-consumer.project-rollout",
    type=Float,
    default=0.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.buffer-window.seconds",
    type=Int,
    default=120,  # 2 minutes
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.buffer-ttl.seconds",
    type=Int,
    default=300,  # 5 minutes
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.detect-performance-issues-consumer.enable",
    default=True,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.send-occurrence-to-platform.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.profile-process-messages.rate",
    type=Float,
    default=0.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.deserialize-spans-rapidjson.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "standalone-spans.deserialize-spans-orjson.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "indexed-spans.agg-span-waterfall.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "traces.sample-list.sample-rate",
    type=Float,
    default=0.0,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "discover.saved-query-dataset-split.enable",
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "discover.saved-query-dataset-split.organization-id-allowlist",
    type=Sequence,
    default=[],
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# Options for setting LLM providers and usecases
register("llm.provider.options", default={}, flags=FLAG_NOSTORE)
# Example provider:
#     "openai": {
#         "options": {
#             "api_key": "",
#         },
#         "models": ["gpt-4-turbo", "gpt-3.5-turbo"],
#     }

register("llm.usecases.options", default={}, flags=FLAG_NOSTORE, type=Dict)
# Example usecase:
#     "suggestedfix": {
#         "provider": "openai",
#         "options": {
#             "model": "gpt-3.5-turbo",
#         },
#     }
# }

register(
    "feedback.filter_garbage_messages",
    type=Bool,
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)

# List of organizations with increased rate limits for organization_events API
register(
    "api.organization_events.rate-limit-increased.orgs",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
# Increased rate limits for organization_events API for the orgs above
register(
    "api.organization_events.rate-limit-increased.limits",
    type=Dict,
    default={"limit": 50, "window": 1, "concurrent_limit": 50},
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)
# Reduced rate limits for organization_events API for the orgs in LA/EA/GA rollout
# Once GA'd, this will be the default rate limit for all orgs not on the increase list
register(
    "api.organization_events.rate-limit-reduced.limits",
    type=Dict,
    default={"limit": 1000, "window": 300, "concurrent_limit": 15},
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

# TODO: remove once removed from options
register(
    "issue_platform.use_kafka_partition_key",
    type=Bool,
    default=False,
    flags=FLAG_PRIORITIZE_DISK | FLAG_AUTOMATOR_MODIFIABLE,
)


register(
    "sentry.save-event-attachments.project-per-5-minute-limit",
    type=Int,
    default=2000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "sentry.save-event-attachments.project-per-sec-limit",
    type=Int,
    default=100,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# max number of profile chunks to use for computing
# the merged profile.
register(
    "profiling.continuous-profiling.chunks-set.size",
    type=Int,
    default=50,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "profiling.continuous-profiling.chunks-query.size",
    type=Int,
    default=250,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enable orjson in the occurrence_consumer.process_[message|batch]
register(
    "issues.occurrence_consumer.use_orjson",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Controls the rate of using the sentry api shared secret for communicating to sentry.
register(
    "seer.api.use-shared-secret",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "similarity.backfill_nodestore_use_multithread",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "similarity.backfill_nodestore_chunk_size",
    default=5,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "similarity.backfill_nodestore_threads",
    default=6,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_snuba_concurrent_requests",
    default=20,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_seer_chunk_size",
    default=30,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_seer_threads",
    default=1,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_project_cohort_size",
    default=1000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_total_worker_count",
    default=6,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.new_project_seer_grouping.enabled",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "similarity.backfill_use_reranking",
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "delayed_processing.batch_size",
    default=10000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "delayed_processing.emit_logs",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "celery_split_queue_task_rollout",
    default={},
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "grouping.grouphash_metadata.ingestion_writes_enabled",
    type=Bool,
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "ecosystem:enable_integration_form_error_raise", default=True, flags=FLAG_AUTOMATOR_MODIFIABLE
)


# Restrict uptime issue creation for specific host provider identifiers. Items
# in this list map to the `host_provider_id` column in the UptimeSubscription
# table.
#
# This may be used to stop issue creation in the event that a network / hosting
# provider blocks the uptime checker causing false positives.
register(
    "uptime.restrict-issue-creation-by-hosting-provider-id",
    type=Sequence,
    default=[],
    flags=FLAG_ALLOW_EMPTY | FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "releases.no_snuba_for_release_creation",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "celery_split_queue_rollout",
    default={"post_process_transactions": 1.0},
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Secret Scanning. Allows to temporarily disable signature verification.
register(
    "secret-scanning.github.enable-signature-verification",
    type=Bool,
    default=True,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Rate limiting for the occurrence consumer
register(
    "issues.occurrence-consumer.rate-limit.quota",
    type=Dict,
    default={"window_seconds": 3600, "granularity_seconds": 60, "limit": 1000},
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "issues.occurrence-consumer.rate-limit.enabled",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
register(
    "eventstore.adjacent_event_ids_use_snql",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Demo mode
register(
    "demo-mode.enabled",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "demo-mode.orgs",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "demo-mode.users",
    default=[],
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# option for sample size when fetching project tag keys
register(
    "visibility.tag-key-sample-size",
    default=1_000_000,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# option for clamping project tag key date range
register(
    "visibility.tag-key-max-date-range.days",
    default=14,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# option used to enable/disable applying
# stack trace rules in profiles
register(
    "profiling.stack_trace_rules.enabled",
    default=False,
    type=Bool,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "performance.event-tracker.sample-rate.transactions",
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# migrating send_alert_event task to not pass Event
register(
    "sentryapps.send_alert_event.use-eventid",
    type=Float,
    default=0.0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# allows us to disable indexing during maintenance events
register(
    "sentry.similarity.indexing.enabled",
    default=True,
    type=Bool,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Enforces a QueryBuilder check that the first relevant event has been sent for each project
register(
    "sentry.search.events.project.check_event",
    default=0.0,
    type=Float,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "uptime.snuba_uptime_results.enabled",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "taskworker.grpc_service_config",
    type=String,
    default="""{"loadBalancingConfig": [{"round_robin": {}}]}""",
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

register(
    "uptime.date_cutoff_epoch_seconds",
    type=Int,
    default=0,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)

# Increases event title character limit
register(
    "sentry.save-event.title-char-limit-256.enabled",
    type=Bool,
    default=False,
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
