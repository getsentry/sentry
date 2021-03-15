# flake8: noqa

from datetime import timedelta

from sentry.conf.server import *


"""
To get this file to load, add the follwing to your sentry.conf.py file:

from sentry.demo.settings import *

"""

DEMO_MODE = True
CELERY_IMPORTS = CELERY_IMPORTS + ("sentry.demo.tasks",)
CELERYBEAT_SCHEDULE["demo_delete_users_orgs"] = {
    "task": "sentry.demo.tasks.delete_users_orgs",
    "schedule": timedelta(hours=1),
    "options": {"expires": 3600, "queue": "cleanup"},
}
MIDDLEWARE_CLASSES = MIDDLEWARE_CLASSES + ("sentry.demo.middleware.DemoMiddleware",)
INSTALLED_APPS = INSTALLED_APPS + ("sentry.demo.apps.Config",)
ROOT_URLCONF = "sentry.demo.urls"
