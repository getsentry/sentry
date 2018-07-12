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
#  GITHUB_APP_ID
#  GITHUB_API_SECRET
#  BITBUCKET_CONSUMER_KEY
#  BITBUCKET_CONSUMER_SECRET
from sentry.conf.server import *  # NOQA

import os
import os.path

CONF_ROOT = os.path.dirname(__file__)

postgres = 'postgres' 
if postgres:
    DATABASES = {
        'default': {
            'ENGINE': 'sentry.db.postgres',
            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': 'postgres',
            'HOST': 'postgres',
            'PORT': '',
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
SENTRY_SINGLE_ORGANIZATION = 'SNTR'

#########
# Redis #
#########

# Generic Redis configuration used as defaults for various things including:
# Buffers, Quotas, TSDB

redis = 'redis'
redis_password = ''
redis_port = '6379'
redis_db = '0'

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

# A primary cache is required for things such as processing events
SENTRY_CACHE = 'sentry.cache.redis.RedisCache'

#########
# Queue #
#########

# See https://docs.getsentry.com/on-premise/server/queue/ for more
# information on configuring your queue broker and workers. Sentry relies
# on a Python framework called Celery to manage queues.

BROKER_URL = 'redis://redis:6379/0'


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

###############
# Mail Server #
###############


#email = env('SENTRY_EMAIL_HOST') or (env('SMTP_PORT_25_TCP_ADDR') and 'smtp')
#if email:
#    SENTRY_OPTIONS['mail.backend'] = 'smtp'
#    SENTRY_OPTIONS['mail.host'] = email
#    SENTRY_OPTIONS['mail.password'] = env('SENTRY_EMAIL_PASSWORD') or ''
#    SENTRY_OPTIONS['mail.username'] = env('SENTRY_EMAIL_USER') or ''
#    SENTRY_OPTIONS['mail.port'] = int(env('SENTRY_EMAIL_PORT') or 25)
#    SENTRY_OPTIONS['mail.use-tls'] = env('SENTRY_EMAIL_USE_TLS', False)
#else:
SENTRY_OPTIONS['mail.backend'] = 'dummy'

# The email address to send on behalf of
SENTRY_OPTIONS['mail.from'] = 'root@localhost'


# If this value ever becomes compromised, it's important to regenerate your
# SENTRY_SECRET_KEY. Changing this value will result in all current sessions
# being invalidated.
secret_key = 'somedockersecret'
if not secret_key:
    raise Exception('Error: SENTRY_SECRET_KEY is undefined, run `generate-secret-key` and set to -e SENTRY_SECRET_KEY')

if 'SENTRY_RUNNING_UWSGI' not in os.environ and len(secret_key) < 32:
    print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    print('!!                    CAUTION                       !!')
    print('!! Your SENTRY_SECRET_KEY is potentially insecure.  !!')
    print('!!    We recommend at least 32 characters long.     !!')
    print('!!     Regenerate with `generate-secret-key`.       !!')
    print('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')

SENTRY_OPTIONS['system.secret-key'] = secret_key

