from __future__ import absolute_import

from django.db import models
from django.utils import timezone
from sentry.db.models import Model, FlexibleForeignKey, sane_repr


class GroupResolution(Model):
    """
    Describes in which release a group was marked as resolved.

    This is used to power the concept of "Ive fixed this in code, but its not
    fixed in the current release".

    In the future this will likely expand to have full commit references, and
    possibly remove the tight association with a release.
    """
    __core__ = False

    group = FlexibleForeignKey('sentry.Group', unique=True)
    # the release in which its suggested this was resolved
    # which allows us to indicate if it still happens in newer versions
    release = FlexibleForeignKey('sentry.Release')
    datetime = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'sentry_groupresolution'
        app_label = 'sentry'

    __repr__ = sane_repr('group_id', 'release_id')
