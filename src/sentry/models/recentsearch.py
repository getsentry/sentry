from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.utils.hashlib import md5_text
from sentry.utils.json import JSONData

MAX_RECENT_SEARCHES = 30


@region_silo_model
class RecentSearch(Model):
    """
    Searches run by users recently.
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    user_id = HybridCloudForeignKey("sentry.User", db_index=False, on_delete="CASCADE")
    type = models.PositiveSmallIntegerField()
    query = models.TextField()
    query_hash = models.CharField(max_length=32)
    last_seen = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_recentsearch"
        unique_together = (("user_id", "organization", "type", "query_hash"),)

    __repr__ = sane_repr("organization_id", "user_id", "type", "query")

    @classmethod
    def sanitize_relocation_json(
        cls, json: JSONData, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "query"), lambda _: "assigned:me")
        sanitizer.set_string(
            json,
            SanitizableField(model_name, "query_hash"),
            lambda _: "60f3c0a69e1c167b4bea16306949dd0f",
        )


def remove_excess_recent_searches(organization, user, search_type):
    """
    Remove any excess recent searches. We do this by sorting by `last_seen`
    descending and removing any rows after the `MAX_RECENT_SEARCHES` row. In
    practice this should only be removing a single row at most.
    """
    recent_searches_to_remove = RecentSearch.objects.filter(
        organization=organization, user_id=user.id, type=search_type
    ).order_by("-last_seen")[MAX_RECENT_SEARCHES:]
    RecentSearch.objects.filter(id__in=recent_searches_to_remove).delete()


@receiver(pre_save, sender=RecentSearch)
def issue_saved(sender, instance, **kwargs):
    if not instance.query_hash:
        instance.query_hash = md5_text(instance.query).hexdigest()
