from datetime import timedelta
from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.utils import metrics
from sentry.utils.cache import cache


class ReleaseStages(str, Enum):
    ADOPTED = "adopted"
    LOW_ADOPTION = "low_adoption"
    REPLACED = "replaced"


class ReleaseProjectEnvironment(Model):
    __include_in_export__ = False

    release = FlexibleForeignKey("sentry.Release")
    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    new_issues_count = BoundedPositiveIntegerField(default=0)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    last_deploy_id = BoundedPositiveIntegerField(null=True, db_index=True)

    adopted = models.DateTimeField(null=True, blank=True)
    unadopted = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseprojectenvironment"
        index_together = (
            ("project", "adopted", "environment"),
            ("project", "unadopted", "environment"),
        )
        unique_together = (("project", "release", "environment"),)

    __repr__ = sane_repr("project", "release", "environment")

    @classmethod
    def get_cache_key(cls, release_id, project_id, environment_id):
        return f"releaseprojectenv:{release_id}:{project_id}:{environment_id}"

    @classmethod
    def get_or_create(cls, release, project, environment, datetime, **kwargs):
        with metrics.timer("models.releaseprojectenvironment.get_or_create") as metrics_tags:
            return cls._get_or_create_impl(
                release, project, environment, datetime, metrics_tags, **kwargs
            )

    @classmethod
    def _get_or_create_impl(cls, release, project, environment, datetime, metrics_tags, **kwargs):
        cache_key = cls.get_cache_key(project.id, release.id, environment.id)

        instance = cache.get(cache_key)
        if instance is None:
            metrics_tags["cache_hit"] = "false"
            instance, created = cls.objects.get_or_create(
                release=release,
                project=project,
                environment=environment,
                defaults={"first_seen": datetime, "last_seen": datetime},
            )
            cache.set(cache_key, instance, 3600)
            metrics_tags["cache_hit"] = "true"
        else:
            created = False

        metrics_tags["created"] = "true" if created else "false"

        # Same as releaseenvironment model. Minimizes last_seen updates to once a minute
        if not created and instance.last_seen < datetime - timedelta(seconds=60):
            cls.objects.filter(
                id=instance.id, last_seen__lt=datetime - timedelta(seconds=60)
            ).update(last_seen=datetime)
            instance.last_seen = datetime
            cache.set(cache_key, instance, 3600)
            metrics_tags["bumped"] = "true"
        else:
            metrics_tags["bumped"] = "false"

        return instance

    @property
    def adoption_stages(self):
        """
        This function takes a list of dictionaries and returns a dictionary with the number of adoptions, unadoptions, and total
        number of releases. The
        function also checks to see if there are any adopted or unadopted releases. If there are no
        adopted or unadopted releases then the stage is set to low
        adoption. If there is only one adopted release then it will be
        set as an adopted release while setting all other releases as not yet released. If more
        than one adopted release exists, 
        then all but the last two will be set as replaced while setting the last two as adopted and not yet released
        respectively. 

            :param self: A list containing dictionaries that contain information about each individual release in order from most recent to
        least recent (i.e., [{'name': 'v1', 'date': datetime(2019, 1, 1)}, {'name': 'v2', 'date': datetime(2019, 2 ,1)}])

            :returns: A dictionary with
        three keys representing number of adoptions (int), number of non-adoptions (int), and total number of releases (int). It also contains another key
        called "stage" which indicates whether an adoption stage
        """
        if self.adopted is not None and self.unadopted is None:
            stage = ReleaseStages.ADOPTED
        elif self.adopted is not None and self.unadopted is not None:
            stage = ReleaseStages.REPLACED
        else:
            stage = ReleaseStages.LOW_ADOPTION

        return {"stage": stage, "adopted": self.adopted, "unadopted": self.unadopted}
