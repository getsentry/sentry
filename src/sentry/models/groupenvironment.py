from django.db.models import DO_NOTHING, DateTimeField
from django.db.models.signals import post_delete
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.cache import cache


class GroupEnvironment(Model):
    __core__ = False

    group = FlexibleForeignKey("sentry.Group", db_constraint=False)
    environment = FlexibleForeignKey("sentry.Environment", db_constraint=False)
    first_release = FlexibleForeignKey(
        "sentry.Release",
        null=True,
        db_constraint=False,
        # We have no index here, so we don't want to use the ORM's cascade
        # delete functionality
        on_delete=DO_NOTHING,
    )
    first_seen = DateTimeField(default=timezone.now, db_index=True, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupenvironment"
        index_together = [("environment", "first_release")]
        unique_together = [("group", "environment")]

    __repr__ = sane_repr("group_id", "environment_id")

    @classmethod
    def _get_cache_key(self, group_id, environment_id):
        return f"groupenv:1:{group_id}:{environment_id}"

    @classmethod
    def get_or_create(cls, group_id, environment_id, defaults=None):
        cache_key = cls._get_cache_key(group_id, environment_id)
        instance = cache.get(cache_key)
        if instance is None:
            instance, created = cls.objects.get_or_create(
                group_id=group_id, environment_id=environment_id, defaults=defaults
            )
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        return instance, created


post_delete.connect(
    lambda instance, **kwargs: cache.delete(
        GroupEnvironment._get_cache_key(instance.group_id, instance.environment_id)
    ),
    sender=GroupEnvironment,
    weak=False,
)
