from __future__ import absolute_import

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class GroupRedirect(Model):
    """
    Maintains a reference from a group that has been merged (and subsequently
    deleted) to the group that superceded it.
    """
    __core__ = False

    group_id = BoundedBigIntegerField(db_index=True)
    previous_group_id = BoundedBigIntegerField(unique=True)

    class Meta:
        db_table = 'sentry_groupredirect'
        app_label = 'sentry'

    __repr__ = sane_repr('group_id', 'previous_group_id')
