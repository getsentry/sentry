from __future__ import absolute_import

from datetime import timedelta
from django.db import models
from django.utils import timezone

from sentry.utils.cache import cache
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr


class ReleaseProjectEnvironment(Model):
    __core__ = False

    release = FlexibleForeignKey("sentry.Release")
    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    new_issues_count = BoundedPositiveIntegerField(default=0)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    last_deploy_id = BoundedPositiveIntegerField(null=True, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseprojectenvironment"
        unique_together = (("project", "release", "environment"),)

    __repr__ = sane_repr("project", "release", "environment")

    @classmethod
    def get_cache_key(cls, release_id, project_id, environment_id):
        return u"releaseprojectenv:{}:{}:{}".format(release_id, project_id, environment_id)

    @classmethod
    def get_or_create(cls, release, project, environment, datetime, **kwargs):
        cache_key = cls.get_cache_key(project.id, release.id, environment.id)

        instance = cache.get(cache_key)
        if instance is None:
            instance, created = cls.objects.get_or_create(
                release=release,
                project=project,
                environment=environment,
                defaults={"first_seen": datetime, "last_seen": datetime},
            )
            cache.set(cache_key, instance, 3600)
        else:
            created = False

        # Same as releaseenvironment model. Minimizes last_seen updates to once a minute
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            cls.objects.filter(
                id=instance.id, last_seen__lt=datetime - timedelta(seconds=60)
            ).update(last_seen=datetime)
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
        return instance
