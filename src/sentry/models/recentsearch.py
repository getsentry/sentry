from __future__ import absolute_import

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.hashlib import md5_text


class RecentSearch(Model):
    """
    Searches run by users recently.
    """
    __core__ = True

    organization = FlexibleForeignKey('sentry.Organization')
    user = FlexibleForeignKey('sentry.User', db_index=False)
    type = models.PositiveSmallIntegerField()
    query = models.TextField()
    query_hash = models.CharField(max_length=32)
    last_seen = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_recentsearch'
        unique_together = (('user', 'organization', 'type', 'query_hash'),)

    __repr__ = sane_repr('organization_id', 'user_id', 'type', 'query')


@receiver(pre_save, sender=RecentSearch)
def issue_saved(sender, instance, **kwargs):
    if not instance.query_hash:
        instance.query_hash = md5_text(instance.query).hexdigest()
