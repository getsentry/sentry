from __future__ import absolute_import

from sentry import deletions

from . import models

deletions.default_manager.register(models.DiscoverSavedQuery, deletions.BulkModelDeletionTask)
deletions.default_manager.register(
    models.DiscoverSavedQueryProject, deletions.BulkModelDeletionTask
)
