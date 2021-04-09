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
CELERYBEAT_SCHEDULE["demo_delete_initializing_orgs"] = {
    "task": "sentry.demo.tasks.delete_initializing_orgs",
    "schedule": timedelta(hours=1),
    "options": {"expires": 3600, "queue": "cleanup"},
}
MIDDLEWARE_CLASSES = MIDDLEWARE_CLASSES + ("sentry.demo.middleware.DemoMiddleware",)
INSTALLED_APPS = INSTALLED_APPS + ("sentry.demo.apps.Config",)
ROOT_URLCONF = "sentry.demo.urls"

DEMO_DATA_GEN_PARAMS = {
    "MAX_DAYS": 10,  # how many days of data
    "SCALE_FACTOR": 2,  # scales the frequency of events
    "BASE_OFFSET": 0.5,  # higher values increases the minimum number of events in an hour
    "NAME_STEP_SIZE": 7,  # higher value means fewer possible test users in sample
    "BREADCRUMB_LOOKBACK_TIME": 5,  # how far back should breadcrumbs go from the time of the event
    "DEFAULT_BACKOFF_TIME": 0,  # backoff time between sending events
    "ERROR_BACKOFF_TIME": 0.5,  # backoff time after a snuba error
    "NUM_RELEASES": 3,
    "ORG_BUFFER_SIZE": 3,  # number of pre-populated organizations in the buffer
    "DAY_DURATION_IMPACT": 500,  # the maximum impact of the day on the durationn
    "DURATION_SIGMA": 600,  # the variability in durations
    "BASE_FRONTEND_DURATION": 2000,  # the average front end duration discounting the day impact
    "MIN_FRONTEND_DURATION": 600,  # absolute minimum duration of a FE transaction
    "MAX_INITIALIZATION_TIME": 60,  # number of minutes to give an organization to initialize
}

# parameters for an org when quickly generating them synchronously
DEMO_DATA_QUICK_GEN_PARAMS = DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_QUICK_GEN_PARAMS.update(MAX_DAYS=1, SCALE_FACTOR=0.25, NAME_STEP_SIZE=200)
