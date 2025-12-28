"""
Celery configuration integration for Hackweek cleanup tasks.

Apply this to your Celery configuration file (typically sentry/conf/server.py
or wherever CELERYBEAT_SCHEDULE is defined).
"""

# ==============================================================================
# Add this to your sentry/conf/server.py or main configuration file
# ==============================================================================

# Import at the top of the file:
from celery.schedules import crontab

# Find the CELERYBEAT_SCHEDULE definition and add the Hackweek cleanup task:
# (If CELERYBEAT_SCHEDULE doesn't exist, create it)

CELERYBEAT_SCHEDULE = CELERYBEAT_SCHEDULE or {}

# Add the Hackweek cleanup task
CELERYBEAT_SCHEDULE.update(
    {
        "cleanup-hackweek-organizations": {
            "task": "getsentry.tasks.hackweek_cleanup.cleanup_expired_hackweek_organizations",
            "schedule": crontab(minute="*/15"),  # Run every 15 minutes
            "options": {
                "expires": 60 * 10,  # Task expires after 10 minutes if not executed
                "queue": "cleanup",  # Optional: use specific queue
                "routing_key": "cleanup.hackweek",  # Optional: routing key
            },
        },
    }
)

# ==============================================================================
# Alternative: If you have a separate celeryconfig.py
# ==============================================================================
"""
# In celeryconfig.py or celery.py:

from celery import Celery
from celery.schedules import crontab

app = Celery('sentry')

# Update beat schedule
app.conf.beat_schedule = {
    # ... existing tasks ...

    'cleanup-hackweek-organizations': {
        'task': 'getsentry.tasks.hackweek_cleanup.cleanup_expired_hackweek_organizations',
        'schedule': crontab(minute='*/15'),
        'options': {
            'expires': 600,
        }
    },
}
"""

# ==============================================================================
# For Testing: More Frequent Cleanup (every 5 minutes)
# ==============================================================================
"""
CELERYBEAT_SCHEDULE['cleanup-hackweek-organizations'] = {
    'task': 'getsentry.tasks.hackweek_cleanup.cleanup_expired_hackweek_organizations',
    'schedule': crontab(minute='*/5'),  # Every 5 minutes for testing
    'options': {
        'expires': 240,  # 4 minute expiry
    }
}
"""

# ==============================================================================
# Verify the task is registered
# ==============================================================================
"""
# To verify in Django shell:
from celery import current_app
print(current_app.conf.beat_schedule.get('cleanup-hackweek-organizations'))

# To manually run the task:
from getsentry.tasks.hackweek_cleanup import cleanup_expired_hackweek_organizations
result = cleanup_expired_hackweek_organizations.delay()
print(result.get())
"""
