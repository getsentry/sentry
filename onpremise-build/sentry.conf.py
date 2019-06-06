# This file is just Python, with a touch of Django which means
# you can inherit and tweak settings to your hearts content.

# For Docker, the following environment variables are supported:
#  SENTRY_POSTGRES_HOST
#  SENTRY_POSTGRES_PORT
#  SENTRY_DB_NAME
#  SENTRY_DB_USER
#  SENTRY_DB_PASSWORD
#  SENTRY_RABBITMQ_HOST
#  SENTRY_RABBITMQ_USERNAME
#  SENTRY_RABBITMQ_PASSWORD
#  SENTRY_RABBITMQ_VHOST
#  SENTRY_REDIS_HOST
#  SENTRY_REDIS_PASSWORD
#  SENTRY_REDIS_PORT
#  SENTRY_REDIS_DB
#  SENTRY_MEMCACHED_HOST
#  SENTRY_MEMCACHED_PORT
#  SENTRY_FILESTORE_DIR
#  SENTRY_SERVER_EMAIL
#  SENTRY_EMAIL_HOST
#  SENTRY_EMAIL_PORT
#  SENTRY_EMAIL_USER
#  SENTRY_EMAIL_PASSWORD
#  SENTRY_EMAIL_USE_TLS
#  SENTRY_ENABLE_EMAIL_REPLIES
#  SENTRY_SMTP_HOSTNAME
#  SENTRY_MAILGUN_API_KEY
#  SENTRY_SINGLE_ORGANIZATION
#  SENTRY_SECRET_KEY
#  (slack integration)
#  SENTRY_SLACK_CLIENT_ID
#  SENTRY_SLACK_CLIENT_SECRET
#  SENTRY_SLACK_VERIFICATION_TOKEN
#  (github plugin, sso)
#  GITHUB_APP_ID
#  GITHUB_API_SECRET
#  (github integration)
#  SENTRY_GITHUB_APP_ID
#  SENTRY_GITHUB_APP_CLIENT_ID
#  SENTRY_GITHUB_APP_CLIENT_SECRET
#  SENTRY_GITHUB_APP_WEBHOOK_SECRET
#  SENTRY_GITHUB_APP_PRIVATE_KEY
#  (azure devops integration)
#  SENTRY_VSTS_CLIENT_ID
#  SENTRY_VSTS_CLIENT_SECRET
#  (bitbucket plugin)
#  BITBUCKET_CONSUMER_KEY
#  BITBUCKET_CONSUMER_SECRET
from sentry.conf.server import *  # NOQA
from sentry.utils.types import Bool, Int

import os
import os.path
import six

CONF_ROOT = os.path.dirname(__file__)

postgres = env('SENTRY_POSTGRES_HOST') or (env('POSTGRES_PORT_5432_TCP_ADDR') and 'postgres')
if postgres:
    DATABASES = {
        'default': {
            'ENGINE': 'sentry.db.postgres',
            'NAME': (
                env('SENTRY_DB_NAME')
                or env('POSTGRES_ENV_POSTGRES_USER')
                or 'postgres'
            ),
            'USER': (
                env('SENTRY_DB_USER')
                or env('POSTGRES_ENV_POSTGRES_USER')
                or 'postgres'
            ),
            'PASSWORD': (
                env('SENTRY_DB_PASSWORD')
                or env('POSTGRES_ENV_POSTGRES_PASSWORD')
                or ''
            ),
            'HOST': postgres,
            'PORT': (
                env('SENTRY_POSTGRES_PORT')
                or ''
            ),
            'OPTIONS': {
                'autocommit': True,
            },
        },
    }

# You should not change this setting after your database has been created
# unless you have altered all schemas first
SENTRY_USE_BIG_INTS = True

# If you're expecting any kind of real traffic on Sentry, we highly recommend
# configuring the CACHES and Redis settings

###########
# General #
###########

# Instruct Sentry that this install intends to be run by a single organization
# and thus various UI optimizations should be enabled.
SENTRY_SINGLE_ORGANIZATION = env('SENTRY_SINGLE_ORGANIZATION', True)

#########
# Redis #
#########

# Generic Redis configuration used as defaults for various things including:
# Buffers, Quotas, TSDB

redis = env('SENTRY_REDIS_HOST') or (env('REDIS_PORT_6379_TCP_ADDR') and 'redis')
if not redis:
    raise Exception('Error: REDIS_PORT_6379_TCP_ADDR (or SENTRY_REDIS_HOST) is undefined, did you forget to `--link` a redis container?')

redis_password = env('SENTRY_REDIS_PASSWORD') or ''
redis_port = env('SENTRY_REDIS_PORT') or '6379'
redis_db = env('SENTRY_REDIS_DB') or '0'

SENTRY_OPTIONS.update({
    'redis.clusters': {
        'default': {
            'hosts': {
                0: {
                    'host': redis,
                    'password': redis_password,
                    'port': redis_port,
                    'db': redis_db,
                },
            },
        },
    },
})

#########
# Cache #
#########

# Sentry currently utilizes two separate mechanisms. While CACHES is not a
# requirement, it will optimize several high throughput patterns.

memcached = env('SENTRY_MEMCACHED_HOST') or (env('MEMCACHED_PORT_11211_TCP_ADDR') and 'memcached')
if memcached:
    memcached_port = (
        env('SENTRY_MEMCACHED_PORT')
        or '11211'
    )
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
            'LOCATION': [memcached + ':' + memcached_port],
            'TIMEOUT': 3600,
        }
    }

# A primary cache is required for things such as processing events
SENTRY_CACHE = 'sentry.cache.redis.RedisCache'

#########
# Queue #
#########

# See https://docs.getsentry.com/on-premise/server/queue/ for more
# information on configuring your queue broker and workers. Sentry relies
# on a Python framework called Celery to manage queues.

rabbitmq = env('SENTRY_RABBITMQ_HOST') or (env('RABBITMQ_PORT_5672_TCP_ADDR') and 'rabbitmq')

if rabbitmq:
    BROKER_URL = (
        'amqp://' + (
            env('SENTRY_RABBITMQ_USERNAME')
            or env('RABBITMQ_ENV_RABBITMQ_DEFAULT_USER')
            or 'guest'
        ) + ':' + (
            env('SENTRY_RABBITMQ_PASSWORD')
            or env('RABBITMQ_ENV_RABBITMQ_DEFAULT_PASS')
            or 'guest'
        ) + '@' + rabbitmq + '/' + (
            env('SENTRY_RABBITMQ_VHOST')
            or env('RABBITMQ_ENV_RABBITMQ_DEFAULT_VHOST')
            or '/'
        )
    )
else:
    BROKER_URL = 'redis://:' + redis_password + '@' + redis + ':' + redis_port + '/' + redis_db


###############
# Rate Limits #
###############

# Rate limits apply to notification handlers and are enforced per-project
# automatically.

SENTRY_RATELIMITER = 'sentry.ratelimits.redis.RedisRateLimiter'

##################
# Update Buffers #
##################

# Buffers (combined with queueing) act as an intermediate layer between the
# database and the storage API. They will greatly improve efficiency on large
# numbers of the same events being sent to the API in a short amount of time.
# (read: if you send any kind of real data to Sentry, you should enable buffers)

SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'

##########
# Quotas #
##########

# Quotas allow you to rate limit individual projects or the Sentry install as
# a whole.

SENTRY_QUOTAS = 'sentry.quotas.redis.RedisQuota'

########
# TSDB #
########

# The TSDB is used for building charts as well as making things like per-rate
# alerts possible.

SENTRY_TSDB = 'sentry.tsdb.redis.RedisTSDB'

###########
# Digests #
###########

# The digest backend powers notification summaries.

SENTRY_DIGESTS = 'sentry.digests.backends.redis.RedisBackend'

################
# File storage #
################

# Uploaded media uses these `filestore` settings. The available
# backends are either `filesystem` or `s3`.

SENTRY_OPTIONS['filestore.backend'] = 'filesystem'
SENTRY_OPTIONS['filestore.options'] = {
    'location': env('SENTRY_FILESTORE_DIR'),
}

##############
# Web Server #
##############

# If you're using a reverse SSL proxy, you should enable the X-Forwarded-Proto
# header and set `SENTRY_USE_SSL=1`

if env('SENTRY_USE_SSL', False):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SOCIAL_AUTH_REDIRECT_IS_HTTPS = True

SENTRY_WEB_HOST = '0.0.0.0'
SENTRY_WEB_PORT = 9000
SENTRY_WEB_OPTIONS = {
    # 'workers': 3,  # the number of web workers
}



##########
# Docker #
##########

# Docker's environment configuration needs to happen
# prior to anything that might rely on these values to
# enable more "smart" configuration.

ENV_CONFIG_MAPPING = {
    'SENTRY_EMAIL_PASSWORD': 'mail.password',
    'SENTRY_EMAIL_USER': 'mail.username',
    'SENTRY_EMAIL_PORT': ('mail.port', Int),
    'SENTRY_EMAIL_USE_TLS': ('mail.use-tls', Bool),
    'SENTRY_EMAIL_HOST': 'mail.host',
    'SENTRY_SERVER_EMAIL': 'mail.from',
    'SENTRY_ENABLE_EMAIL_REPLIES': 'mail.enable-replies',
    'SENTRY_SMTP_HOSTNAME': 'mail.reply-hostname',
    'SENTRY_SECRET_KEY': 'system.secret-key',

    # If you're using mailgun for inbound mail, set your API key and configure a
    # route to forward to /api/hooks/mailgun/inbound/
    'SENTRY_MAILGUN_API_KEY': 'mail.mailgun-api-key',

    'SENTRY_SLACK_CLIENT_ID': 'slack.client-id',
    'SENTRY_SLACK_CLIENT_SECRET': 'slack.client-secret',
    'SENTRY_SLACK_VERIFICATION_TOKEN': 'slack.verification-token',

    'SENTRY_GITHUB_APP_ID': ('github-app.id', Int),
    'SENTRY_GITHUB_APP_CLIENT_ID': 'github-app.client-id',
    'SENTRY_GITHUB_APP_CLIENT_SECRET': 'github-app.client-secret',
    'SENTRY_GITHUB_APP_WEBHOOK_SECRET': 'github-app.webhook-secret',
    'SENTRY_GITHUB_APP_PRIVATE_KEY': 'github-app.private-key',

    'SENTRY_VSTS_CLIENT_ID': 'vsts.client-id',
    'SENTRY_VSTS_CLIENT_SECRET': 'vsts.client-secret',
}


def bind_env_config(config=SENTRY_OPTIONS, mapping=ENV_CONFIG_MAPPING):
    """
    Automatically bind SENTRY_OPTIONS from a set of environment variables.
    """
    for env_var, item in six.iteritems(mapping):
        # HACK: we need to check both in `os.environ` and `env._cache`.
        # This is very much an implementation detail leaking out
        # due to assumptions about how `env` would be used previously.
        # `env` will pop values out of `os.environ` when they are seen,
        # so checking against `os.environ` only means it's likely
        # they won't exist if `env()` has been called on the variable
        # before at any point. So we're choosing to check both, but this
        # behavior is different since we're trying to only conditionally
        # apply variables, instead of setting them always.
        if env_var not in os.environ and env_var not in env._cache:
            continue
        if isinstance(item, tuple):
            opt_key, type_ = item
        else:
            opt_key, type_ = item, None
        config[opt_key] = env(env_var, type=type_)

# If this value ever becomes compromised, it's important to regenerate your
# SENTRY_SECRET_KEY. Changing this value will result in all current sessions
# being invalidated.
secret_key = env('SENTRY_SECRET_KEY')
if not secret_key:
    raise Exception('Error: SENTRY_SECRET_KEY is undefined, run `generate-secret-key` and set to -e SENTRY_SECRET_KEY')

if 'SENTRY_RUNNING_UWSGI' not in os.environ and len(secret_key) < 32:
    print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    print('!!                    CAUTION                       !!')
    print('!! Your SENTRY_SECRET_KEY is potentially insecure.  !!')
    print('!!    We recommend at least 32 characters long.     !!')
    print('!!     Regenerate with `generate-secret-key`.       !!')
    print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')

# Grab the easy configuration first - these are all fixed
# key=value with no logic behind them
bind_env_config()

# If you specify a MAILGUN_API_KEY, you definitely want EMAIL_REPLIES
if SENTRY_OPTIONS.get('mail.mailgun-api-key'):
    SENTRY_OPTIONS.setdefault('mail.enable-replies', True)

if 'GITHUB_APP_ID' in os.environ:
    GITHUB_EXTENDED_PERMISSIONS = ['repo']
    GITHUB_APP_ID = env('GITHUB_APP_ID')
    GITHUB_API_SECRET = env('GITHUB_API_SECRET')

if 'BITBUCKET_CONSUMER_KEY' in os.environ:
    BITBUCKET_CONSUMER_KEY = env('BITBUCKET_CONSUMER_KEY')
    BITBUCKET_CONSUMER_SECRET = env('BITBUCKET_CONSUMER_SECRET')
