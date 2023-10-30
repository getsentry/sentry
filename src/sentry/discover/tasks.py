from sentry import deletions
from sentry.deletions.base import BulkModelDeletionTask

from . import models

deletions.default_manager.register(models.DiscoverSavedQuery, BulkModelDeletionTask)
deletions.default_manager.register(models.DiscoverSavedQueryProject, BulkModelDeletionTask)
