# sentry.sandbox.conf.py — Sentry settings for sandbox environments
#
# This configuration is used when running Sentry inside agent sandboxes.
# It configures database, cache, and other settings to point at the
# Docker Compose sidecar services.

import os

from sentry.conf.server import *  # noqa: F401,F403

env = os.environ.get

# =============================================================================
# Databases — point at the sandbox Postgres sidecar
# =============================================================================
DATABASES = {
    "default": {
        "ENGINE": "sentry.db.postgres",
        "NAME": env("SENTRY_DB_NAME", "sentry"),
        "USER": env("SENTRY_DB_USER", "postgres"),
        "PASSWORD": env("SENTRY_DB_PASSWORD", "postgres"),
        "HOST": env("SENTRY_POSTGRES_HOST", "postgres"),
        "PORT": env("SENTRY_POSTGRES_PORT", "5432"),
        "OPTIONS": {},
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
    },
    # Include control/region for silo-aware tests
    "control": {
        "ENGINE": "sentry.db.postgres",
        "NAME": "control",
        "USER": env("SENTRY_DB_USER", "postgres"),
        "PASSWORD": env("SENTRY_DB_PASSWORD", "postgres"),
        "HOST": env("SENTRY_POSTGRES_HOST", "postgres"),
        "PORT": env("SENTRY_POSTGRES_PORT", "5432"),
        "OPTIONS": {},
    },
}

# Region database is the default in silo mode
DATABASE_ROUTERS = ("sentry.db.router.SiloRouter",)

# =============================================================================
# Redis — point at the sandbox Redis sidecar
# =============================================================================
SENTRY_OPTIONS["redis.clusters"] = {
    "default": {
        "hosts": [
            {
                "host": env("SENTRY_REDIS_HOST", "redis"),
                "port": int(env("SENTRY_REDIS_PORT", "6379")),
            }
        ]
    }
}

# =============================================================================
# Caches
# =============================================================================
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"redis://{env('SENTRY_REDIS_HOST', 'redis')}:{env('SENTRY_REDIS_PORT', '6379')}/2",
    }
}

# =============================================================================
# Celery — use Redis as broker (no Kafka needed for most tests)
# =============================================================================
CELERY_BROKER_URL = f"redis://{env('SENTRY_REDIS_HOST', 'redis')}:{env('SENTRY_REDIS_PORT', '6379')}/1"
CELERY_ALWAYS_EAGER = True
CELERY_EAGER_PROPAGATES_EXCEPTIONS = True

# =============================================================================
# Sandbox-specific settings
# =============================================================================
# Disable features that need external services not in the sandbox
SENTRY_FEATURES = {
    **SENTRY_FEATURES,  # noqa: F405
    "organizations:discover": False,
    "organizations:performance-view": False,
}

# Skip service validation checks
SENTRY_SKIP_SERVICE_VALIDATION = True

# Development mode
DEBUG = True
TESTING = True

# Secret key for sandbox
SECRET_KEY = "sandbox-secret-key-not-for-production"

# Disable rate limiting in sandbox
SENTRY_RATELIMITER = "sentry.ratelimits.redis.RedisRateLimiter"
