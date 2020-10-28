from __future__ import absolute_import

from datetime import timedelta
from django.db import models
from django.utils import timezone

from sentry.utils.cache import cache
from sentry.utils import metrics
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class ReleaseEnvironment(Model):
    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization", db_index=True, db_constraint=False)
    # DEPRECATED
    project_id = BoundedPositiveIntegerField(null=True)
    release = FlexibleForeignKey("sentry.Release", db_index=True, db_constraint=False)
    environment = FlexibleForeignKey("sentry.Environment", db_index=True, db_constraint=False)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environmentrelease"
        unique_together = (("organization", "release", "environment"),)

    __repr__ = sane_repr("organization_id", "release_id", "environment_id")

    @classmethod
    def get_cache_key(cls, organization_id, release_id, environment_id):
        return u"releaseenv:2:{}:{}:{}".format(organization_id, release_id, environment_id)

    @classmethod
    def get_or_create(cls, project, release, environment, datetime, **kwargs):
        with metrics.timer("models.releaseenvironment.get_or_create") as metric_tags:
            return cls._get_or_create_impl(project, release, environment, datetime, metric_tags)

    @classmethod
    def _get_or_create_impl(cls, project, release, environment, datetime, metric_tags):
        cache_key = cls.get_cache_key(project.id, release.id, environment.id)

        instance = cache.get(cache_key)
        if instance is None:
            metric_tags["cache_hit"] = "false"
            instance, created = cls.objects.get_or_create(
                release_id=release.id,
                organization_id=project.organization_id,
                environment_id=environment.id,
                defaults={"first_seen": datetime, "last_seen": datetime},
            )
            cache.set(cache_key, instance, 3600)
        else:
            metric_tags["cache_hit"] = "true"
            created = False

        metric_tags["created"] = "true" if created else "false"

        # TODO(dcramer): this would be good to buffer, but until then we minimize
        # updates to once a minute, and allow Postgres to optimistically skip
        # it even if we can't
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            metric_tags["bumped"] = "true"
            cls.objects.filter(
                id=instance.id, last_seen__lt=datetime - timedelta(seconds=60)
            ).update(last_seen=datetime)
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
        else:
            metric_tags["bumped"] = "false"

        return instance
