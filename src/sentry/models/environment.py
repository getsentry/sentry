import re

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.constants import ENVIRONMENT_NAME_MAX_LENGTH, ENVIRONMENT_NAME_PATTERN
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

OK_NAME_PATTERN = re.compile(ENVIRONMENT_NAME_PATTERN)


class EnvironmentProject(Model):
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    is_hidden = models.NullBooleanField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environmentproject"
        unique_together = (("project", "environment"),)


class Environment(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField()
    projects = models.ManyToManyField("sentry.Project", through=EnvironmentProject)
    # DEPRECATED, use projects
    project_id = BoundedPositiveIntegerField(null=True)
    name = models.CharField(max_length=64)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environment"
        unique_together = (("organization_id", "name"),)

    __repr__ = sane_repr("organization_id", "name")

    @classmethod
    def is_valid_name(cls, value):
        """Limit length and reject problematic bytes

        If you change the rules here also update the event ingestion schema in Relay.
        """
        if len(value) > ENVIRONMENT_NAME_MAX_LENGTH:
            return False
        return OK_NAME_PATTERN.match(value) is not None

    @classmethod
    def get_cache_key(cls, organization_id, name):
        return f"env:2:{organization_id}:{md5_text(name).hexdigest()}"

    @classmethod
    def get_name_or_default(cls, name):
        return name or ""

    @classmethod
    def get_for_organization_id(cls, organization_id, name):
        name = cls.get_name_or_default(name)

        cache_key = cls.get_cache_key(organization_id, name)

        env = cache.get(cache_key)
        if env is None:
            env = cls.objects.get(name=name, organization_id=organization_id)
            cache.set(cache_key, env, 3600)

        return env

    @classmethod
    def get_or_create(cls, project, name):
        with metrics.timer("models.environment.get_or_create") as metrics_tags:
            name = cls.get_name_or_default(name)

            cache_key = cls.get_cache_key(project.organization_id, name)

            env = cache.get(cache_key)
            if env is None:
                metrics_tags["cache_hit"] = "false"
                env = cls.objects.get_or_create(name=name, organization_id=project.organization_id)[
                    0
                ]
                cache.set(cache_key, env, 3600)
            else:
                metrics_tags["cache_hit"] = "true"

            env.add_project(project)

            return env

    def add_project(self, project, is_hidden=None):
        cache_key = f"envproj:c:{self.id}:{project.id}"

        if cache.get(cache_key) is None:
            try:
                with transaction.atomic():
                    EnvironmentProject.objects.create(
                        project=project, environment=self, is_hidden=is_hidden
                    )
                cache.set(cache_key, 1, 3600)
            except IntegrityError:
                # We've already created the object, should still cache the action.
                cache.set(cache_key, 1, 3600)

    @staticmethod
    def get_name_from_path_segment(segment):
        # In cases where the environment name is passed as a URL path segment,
        # the (case-sensitive) string "none" represents the empty string
        # environment name for historic reasons (see commit b09858f.) In all
        # other contexts (incl. request query string parameters), the empty
        # string should be used.
        return segment if segment != "none" else ""
