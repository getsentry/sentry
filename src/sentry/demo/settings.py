from datetime import timedelta
from django.conf import settings

from sentry.conf.server import *  # NOQA

if settings.DEMO_MODE:
    settings.CELERYBEAT_SCHEDULE["demo_delete_users_orgs"] = {
        "task": "sentry.demo.tasks.delete_users_orgs",
        "schedule": timedelta(hours=1),
        "options": {"expires": 3600, "queue": "cleanup"},
    }
