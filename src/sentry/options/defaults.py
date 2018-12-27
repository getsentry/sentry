"""
sentry.options.defaults
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
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
register('system.admin-email', flags=FLAG_REQUIRED)
register('system.support-email', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('system.security-email', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('system.databases', type=Dict, flags=FLAG_NOSTORE)
# register('system.debug', default=False, flags=FLAG_NOSTORE)
register('system.rate-limit', default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('system.event-retention-days', default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('system.secret-key', flags=FLAG_NOSTORE)
# Absolute URL to the sentry root directory. Should not include a trailing slash.
register('system.url-prefix', ttl=60, grace=3600, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('system.root-api-key', flags=FLAG_PRIORITIZE_DISK)
register('system.logging-format', default=LoggingFormat.HUMAN, flags=FLAG_NOSTORE)
# This is used for the chunk upload endpoint
register('system.upload-url-prefix', flags=FLAG_PRIORITIZE_DISK)

# Redis
register(
    'redis.clusters',
    type=Dict,
    default={
        'default': {
            'hosts': {
                0: {
                    'host': '127.0.0.1',
                    'port': 6379,
                }
            },
        },
    },
    flags=FLAG_NOSTORE | FLAG_IMMUTABLE
)
register('redis.options', type=Dict, flags=FLAG_NOSTORE)

# symbolizer specifics
register('dsym.cache-path', type=String, default='/tmp/sentry-dsym-cache')

# Mail
register('mail.backend', default='smtp', flags=FLAG_NOSTORE)
register('mail.host', default='localhost', flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.port', default=25, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.username', flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.password', flags=FLAG_REQUIRED | FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.use-tls', default=False, flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.subject-prefix', default='[Sentry] ', flags=FLAG_PRIORITIZE_DISK)
register('mail.from', default='root@localhost', flags=FLAG_REQUIRED | FLAG_PRIORITIZE_DISK)
register('mail.list-namespace', type=String, default='localhost', flags=FLAG_NOSTORE)
register('mail.enable-replies', default=False, flags=FLAG_PRIORITIZE_DISK)
register('mail.reply-hostname', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.mailgun-api-key', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('mail.timeout', default=10, type=Int, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# SMS
register('sms.twilio-account', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('sms.twilio-token', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('sms.twilio-number', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# U2F
register('u2f.app-id', default='', flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('u2f.facets', default=(), type=Sequence, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

register('auth.ip-rate-limit', default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register('auth.user-rate-limit', default=0, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    'auth.allow-registration',
    default=False,
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK | FLAG_REQUIRED
)

register('api.rate-limit.org-create', default=5, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)

# Beacon
register('beacon.anonymous', type=Bool, flags=FLAG_REQUIRED)

# Filestore
register('filestore.backend', default='filesystem', flags=FLAG_NOSTORE)
register('filestore.options', default={'location': '/tmp/sentry-files'}, flags=FLAG_NOSTORE)

# Symbol server
register('symbolserver.enabled', default=False, flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK)
register(
    'symbolserver.options',
    default={'url': 'http://127.0.0.1:3000'},
    flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK
)

# Analytics
register('analytics.backend', default='noop', flags=FLAG_NOSTORE)
register('analytics.options', default={}, flags=FLAG_NOSTORE)

register('cloudflare.secret-key', default='')

# Tagstore
register('tagstore.multi-sampling', default=0.0)

# Slack Integration
register('slack.client-id', flags=FLAG_PRIORITIZE_DISK)
register('slack.client-secret', flags=FLAG_PRIORITIZE_DISK)
register('slack.verification-token', flags=FLAG_PRIORITIZE_DISK)

# Github Integration
register('github-app.id', default=0)
register('github-app.name', default='')
register('github-app.webhook-secret', default='')
register('github-app.private-key', default='')
register('github-app.client-id', flags=FLAG_PRIORITIZE_DISK)
register('github-app.client-secret', flags=FLAG_PRIORITIZE_DISK)

# VSTS Integration
register('vsts.client-id', flags=FLAG_PRIORITIZE_DISK)
register('vsts.client-secret', flags=FLAG_PRIORITIZE_DISK)

# Snuba
register('snuba.use_group_id_column', default=True)
register('snuba.search.pre-snuba-candidates-optimizer', type=Bool, default=False)
register('snuba.search.pre-snuba-candidates-percentage', default=0.2)
register('snuba.search.project-group-count-cache-time', default=24 * 60 * 60)
register('snuba.search.min-pre-snuba-candidates', default=500)
register('snuba.search.max-pre-snuba-candidates', default=5000)
register('snuba.search.chunk-growth-rate', default=1.5)
register('snuba.search.max-chunk-size', default=2000)
register('snuba.search.max-total-chunk-time-seconds', default=30.0)

# Kafka Publisher
register('kafka-publisher.raw-event-sample-rate', default=0.0)
register('kafka-publisher.max-event-size', default=100000)

# Event Stream
register('eventstream.kafka.send-post_process-task', type=Bool, default=True)
