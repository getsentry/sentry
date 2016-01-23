# flake8: noqa
from sentry.conf.server import *  # NOQA

import os.path

CONF_ROOT = os.path.dirname(__file__)

DEBUG = True

# environment variables that would be set by a docker link
REDIS_ADDR = os.environ['REDIS_PORT_6379_TCP_ADDR']
REDIS_PORT = int(os.environ['REDIS_PORT_6379_TCP_PORT'])
POSTGRES_ADDR = os.environ['DB_PORT_5432_TCP_ADDR']
POSTGRES_PORT = int(os.environ['DB_PORT_5432_TCP_PORT'])

DATABASES = {
    'default': {
        'ENGINE': 'sentry.db.postgres',
        'NAME': 'sentry',
        'USER': 'sentry',
        'PASSWORD': '',
        'HOST': POSTGRES_ADDR,
        'PORT': POSTGRES_PORT,
    }
}
#########
# Redis #
#########

# Generic Redis configuration used as defaults for various things including:
# Buffers, Quotas, TSDB

SENTRY_REDIS_OPTIONS = {
    'hosts': {
        0: {
            'host': REDIS_ADDR,
            'port': REDIS_PORT,
        }
    }
}

#########
# Cache #
#########

# Sentry currently utilizes two separate mechanisms. While CACHES is not a
# requirement, it will optimize several high throughput patterns.

# If you wish to use memcached, install the dependencies and adjust the config
# as shown:
#
#   pip install python-memcached
#
# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.memcached.MemcachedCache',
#         'LOCATION': ['127.0.0.1:11211'],
#     }
# }

SECRET_KEY = 'DOCKER_SECRET_KEY_NOT_REALLY_SECRET'
