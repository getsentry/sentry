from datetime import timedelta

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, BoundedPositiveIntegerField, Model, sane_repr
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


class GroupRelease(Model):
    __core__ = False

    # TODO: Should be BoundedBigIntegerField
    project_id = BoundedPositiveIntegerField(db_index=True)
    group_id = BoundedBigIntegerField()
    # TODO: Should be BoundedBigIntegerField
    release_id = BoundedPositiveIntegerField(db_index=True)
    environment = models.CharField(max_length=64, default="")
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouprelease"
        unique_together = (("group_id", "release_id", "environment"),)
        index_together = (
            ("group_id", "first_seen"),
            ("group_id", "last_seen"),
        )

    __repr__ = sane_repr("group_id", "release_id")

    @classmethod
    def get_cache_key(cls, group_id, release_id, environment):
        return "grouprelease:1:{}:{}".format(
            group_id, md5_text(f"{release_id}:{environment}").hexdigest()
        )

    @classmethod
    def get_or_create(cls, group, release, environment, datetime, **kwargs):
        cache_key = cls.get_cache_key(group.id, release.id, environment.name)

        instance = cache.get(cache_key)
        if instance is None:
            try:
                with transaction.atomic():
                    instance, created = (
                        cls.objects.create(
                            release_id=release.id,
                            group_id=group.id,
                            environment=environment.name,
                            project_id=group.project_id,
                            first_seen=datetime,
                            last_seen=datetime,
                        ),
                        True,
                    )
            except IntegrityError:
                instance, created = (
                    cls.objects.get(
                        release_id=release.id, group_id=group.id, environment=environment.name
                    ),
                    False,
                )
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        # TODO(dcramer): this would be good to buffer, but until then we minimize
        # updates to once a minute, and allow Postgres to optimistically skip
        # it even if we can't
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            cls.objects.filter(
                id=instance.id, last_seen__lt=datetime - timedelta(seconds=60)
            ).update(last_seen=datetime)
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
        return instance
