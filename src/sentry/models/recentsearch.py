from __future__ import absolute_import

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.hashlib import md5_text


MAX_RECENT_SEARCHES = 30


class RecentSearch(Model):
    """
    Searches run by users recently.
    """

    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey("sentry.User", db_index=False)
    type = models.PositiveSmallIntegerField()
    query = models.TextField()
    query_hash = models.CharField(max_length=32)
    last_seen = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_recentsearch"
        unique_together = (("user", "organization", "type", "query_hash"),)

    __repr__ = sane_repr("organization_id", "user_id", "type", "query")


def remove_excess_recent_searches(organization, user, search_type):
    """
    Remove any excess recent searches. We do this by sorting by `last_seen`
    descending and removing any rows after the `MAX_RECENT_SEARCHES` row. In
    practice this should only be removing a single row at most.
    """
    recent_searches_to_remove = RecentSearch.objects.filter(
        organization=organization, user=user, type=search_type
    ).order_by("-last_seen")[MAX_RECENT_SEARCHES:]
    RecentSearch.objects.filter(id__in=recent_searches_to_remove).delete()


@receiver(pre_save, sender=RecentSearch)
def issue_saved(sender, instance, **kwargs):
    if not instance.query_hash:
        instance.query_hash = md5_text(instance.query).hexdigest()
