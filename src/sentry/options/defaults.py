from __future__ import absolute_import, print_function

from sentry.logging import LoggingFormat
from sentry.options import (
    FLAG_IMMUTABLE,
    FLAG_NOSTORE,
    FLAG_PRIORITIZE_DISK,
    FLAG_REQUIRED,
    FLAG_ALLOW_EMPTY,
    register,
)
from sentry.utils.types import Bool, Dict, String, Sequence, Int

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

# Mail
register("mail.backend", default="smtp", flags=FLAG_NOSTORE)
register("mail.host", default="127.0.0.1", flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.port", default=25, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register("mail.username", flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.password", flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register("mail.use-tls", default=False, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
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

# Analytics
register("analytics.backend", default="noop", flags=FLAG_NOSTORE)
register("analytics.options", default={}, flags=FLAG_NOSTORE)

register("cloudflare.secret-key", default="")

# Slack Integration
register("slack.client-id", flags=FLAG_PRIORITIZE_DISK)
register("slack.client-secret", flags=FLAG_PRIORITIZE_DISK)
register("slack.verification-token", flags=FLAG_PRIORITIZE_DISK)
register("slack.signing-secret", flags=FLAG_PRIORITIZE_DISK)
register("slack.legacy-app", flags=FLAG_PRIORITIZE_DISK, type=Bool, default=True)

# Slack V2 Integration
register("slack-v2.client-id", flags=FLAG_PRIORITIZE_DISK)
register("slack-v2.client-secret", flags=FLAG_PRIORITIZE_DISK)
register("slack-v2.signing-secret", flags=FLAG_PRIORITIZE_DISK)

# GitHub Integration
register("github-app.id", default=0)
register("github-app.name", default="")
register("github-app.webhook-secret", default="")
register("github-app.private-key", default="")
register("github-app.client-id", flags=FLAG_PRIORITIZE_DISK)
register("github-app.client-secret", flags=FLAG_PRIORITIZE_DISK)

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
register("store.transactions-celery", default=False)

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

# Runtime switch for transitioning post_process to using a cache key
# instead of passing the entire event in the celery parameters.
register("postprocess.use-cache-key", default=0.0, flags=FLAG_PRIORITIZE_DISK)
