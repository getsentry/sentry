from __future__ import absolute_import

import logging

import six
from django.db import models

from sentry.constants import LOG_LEVELS, MAX_CULPRIT_LENGTH
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
)

TOMBSTONE_FIELDS_FROM_GROUP = ("project_id", "level", "message", "culprit", "data")


class GroupTombstone(Model):
    __core__ = False

    previous_group_id = BoundedPositiveIntegerField(unique=True)
    project = FlexibleForeignKey("sentry.Project")
    level = BoundedPositiveIntegerField(
        choices=[(key, six.text_type(val)) for key, val in sorted(LOG_LEVELS.items())],
        default=logging.ERROR,
        blank=True,
    )
    message = models.TextField()
    culprit = models.CharField(max_length=MAX_CULPRIT_LENGTH, blank=True, null=True)
    data = GzippedDictField(blank=True, null=True)
    actor_id = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouptombstone"

    def get_event_type(self):
        """
        Return the type of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data.get("type", "default")

    def get_event_metadata(self):
        """
        Return the metadata of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data["metadata"]
