"""
Django settings integration for Hackweek functionality.

Add these settings to your main Django settings file (sentry/conf/server.py
or your environment-specific settings file).
"""

# ==============================================================================
# Add to your sentry/conf/server.py or settings file
# ==============================================================================

# ==================
# Hackweek Settings
# ==================

# Control whether Hackweek organizations are automatically cleaned up
HACKWEEK_CLEANUP_ENABLED = env.bool("HACKWEEK_CLEANUP_ENABLED", True)

# Use soft delete (mark as pending) vs hard delete (immediate removal)
# Soft delete is safer and allows recovery if needed
HACKWEEK_SOFT_DELETE = env.bool("HACKWEEK_SOFT_DELETE", True)

# Hours before an unclaimed Hackweek org is deleted
HACKWEEK_CLEANUP_AFTER_HOURS = env.int("HACKWEEK_CLEANUP_AFTER_HOURS", 1)

# Maximum number of organizations to process in one cleanup run
HACKWEEK_CLEANUP_BATCH_SIZE = env.int("HACKWEEK_CLEANUP_BATCH_SIZE", 20)

# Maximum deletion retry attempts before giving up
HACKWEEK_MAX_DELETION_RETRIES = env.int("HACKWEEK_MAX_DELETION_RETRIES", 3)

# Celery queue for cleanup tasks
HACKWEEK_CLEANUP_QUEUE = env.str("HACKWEEK_CLEANUP_QUEUE", "cleanup")

# Enable debug logging for Hackweek operations
HACKWEEK_DEBUG = env.bool("HACKWEEK_DEBUG", DEBUG)

# ==============================================================================
# For different environments
# ==============================================================================

if ENVIRONMENT == "development":
    # More aggressive cleanup for development
    HACKWEEK_CLEANUP_AFTER_HOURS = 0.25  # 15 minutes
    HACKWEEK_CLEANUP_BATCH_SIZE = 50
    HACKWEEK_DEBUG = True

elif ENVIRONMENT == "staging":
    # Test with production-like settings
    HACKWEEK_CLEANUP_AFTER_HOURS = 1
    HACKWEEK_CLEANUP_BATCH_SIZE = 20
    HACKWEEK_SOFT_DELETE = True

elif ENVIRONMENT == "production":
    # Conservative production settings
    HACKWEEK_CLEANUP_AFTER_HOURS = 1
    HACKWEEK_CLEANUP_BATCH_SIZE = 10
    HACKWEEK_SOFT_DELETE = True  # Always use soft delete in production
    HACKWEEK_MAX_DELETION_RETRIES = 5

# ==============================================================================
# Feature flags (if using feature flag system)
# ==============================================================================

SENTRY_FEATURES.update(
    {
        # Enable Hackweek organization features
        "organizations:hackweek-cleanup": True,
        "organizations:hackweek-claiming": True,
        "organizations:hackweek-ui": True,
    }
)

# ==============================================================================
# Logging configuration for Hackweek
# ==============================================================================

LOGGING["loggers"].update(
    {
        "getsentry.hackweek": {
            "level": "DEBUG" if HACKWEEK_DEBUG else "INFO",
            "handlers": ["console", "internal"],
            "propagate": False,
        },
        "getsentry.hackweek.cleanup": {
            "level": "DEBUG" if HACKWEEK_DEBUG else "INFO",
            "handlers": ["console", "internal"],
            "propagate": False,
        },
        "getsentry.hackweek.deletion": {
            "level": "INFO",
            "handlers": ["console", "internal"],
            "propagate": False,
        },
    }
)

# ==============================================================================
# Validation
# ==============================================================================

# Ensure settings are valid
assert HACKWEEK_CLEANUP_AFTER_HOURS > 0, "Cleanup hours must be positive"
assert HACKWEEK_CLEANUP_BATCH_SIZE > 0, "Batch size must be positive"
assert HACKWEEK_MAX_DELETION_RETRIES >= 0, "Retries must be non-negative"
