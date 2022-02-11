import logging

from django.conf import settings

logger = logging.getLogger("sentry.tasks.code_owners")

__all__ = (
    "code_owners_auto_sync",
    "update_code_owners_schema",
    "logger",
)

_tasks_list = ("code_owners_auto_sync", "update_code_owners_schema")
settings.CELERY_IMPORTS += tuple(f"sentry.tasks.code_owners.{task}" for task in _tasks_list)

from .code_owners_auto_sync import code_owners_auto_sync
from .update_code_owners_schema import update_code_owners_schema
