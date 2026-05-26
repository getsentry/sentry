from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.last_seen import try_bump_last_seen


@cell_silo_model
class ReleaseEnvironment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", db_index=True, db_constraint=False)
    # DEPRECATED
    project_id = BoundedBigIntegerField(null=True)
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
    def get_cache_key(cls, organization_id, release_id, environment_id) -> str:
        return f"releaseenv:2:{organization_id}:{release_id}:{environment_id}"

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

        if not created:
            try_bump_last_seen(
                model_class=cls,
                instance=instance,
                datetime=datetime,
                bump_key=f"releaseenv_bump:{instance.id}",
                cache_key=cache_key,
                metrics_tags=metric_tags,
            )
        else:
            metric_tags["bumped"] = "false"

        return instance
