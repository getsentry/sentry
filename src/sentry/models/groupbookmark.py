"""
sentry.models.groupbookmark
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings

from sentry.db.models import FlexibleForeignKey, Model, BaseManager, sane_repr


class GroupBookmark(Model):
    """
    Identifies a bookmark relationship between a user and an
    aggregated event (Group).
    """
    project = FlexibleForeignKey('sentry.Project', related_name="bookmark_set")
    group = FlexibleForeignKey('sentry.Group', related_name="bookmark_set")
    # namespace related_name on User since we don't own the model
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_bookmark_set")

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupbookmark'
        # composite index includes project for efficient queries
        unique_together = (('project', 'user', 'group'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')
