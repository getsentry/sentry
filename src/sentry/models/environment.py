import re
from typing import ClassVar, Self
from urllib.parse import unquote

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.constants import ENVIRONMENT_NAME_MAX_LENGTH, ENVIRONMENT_NAME_PATTERN
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.models.metric_tags import DATA_ACCESS_TAG, DataAccessTagValues
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

OK_NAME_PATTERN = re.compile(ENVIRONMENT_NAME_PATTERN)


@cell_silo_model
class EnvironmentProject(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    environment = FlexibleForeignKey("sentry.Environment")
    is_hidden = models.BooleanField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environmentproject"
        unique_together = (("project", "environment"),)


@cell_silo_model
class Environment(Model):
    __relocation_scope__ = RelocationScope.Organization

    organization_id = BoundedBigIntegerField()
    projects = models.ManyToManyField("sentry.Project", through=EnvironmentProject)
    name = models.CharField(max_length=ENVIRONMENT_NAME_MAX_LENGTH)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=["pk"])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_environment"
        unique_together = (("organization_id", "name"),)

    __repr__ = sane_repr("organization_id", "name")

    @classmethod
    def is_valid_name(cls, value):
        """Limit length and reject problematic bytes

        If you change the rules here also update the event + monitor check-in ingestion schema in Relay.
        """
        if len(value) > ENVIRONMENT_NAME_MAX_LENGTH:
            return False
        return OK_NAME_PATTERN.match(value) is not None

    @classmethod
    def get_cache_key(cls, organization_id, name) -> str:
        return f"env:2:{organization_id}:{md5_text(name).hexdigest()}"

    @classmethod
    def get_name_or_default(cls, name):
        if name:
            return name[:ENVIRONMENT_NAME_MAX_LENGTH]
        return ""

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
    def get_or_create(cls, project, name, metrics_tags=None, project_metrics_tags=None):
        with metrics.timer("models.environment.get_or_create") as timer_tags:
            name = cls.get_name_or_default(name)

            cache_key = cls.get_cache_key(project.organization_id, name)

            env = cache.get(cache_key)
            if env is None:
                timer_tags["cache_hit"] = "false"
                env, created = cls.objects.get_or_create(
                    name=name, organization_id=project.organization_id
                )
                cache.set(cache_key, env, 3600)
                if metrics_tags is not None:
                    metrics_tags[DATA_ACCESS_TAG] = (
                        DataAccessTagValues.DB_CREATE.value
                        if created
                        else DataAccessTagValues.DB_READ.value
                    )
            else:
                timer_tags["cache_hit"] = "true"
                if metrics_tags is not None:
                    metrics_tags[DATA_ACCESS_TAG] = DataAccessTagValues.CACHE_HIT.value

            # Unconditional, including on a cache hit above, so it is recorded
            # separately as the `environmentproject` model.
            env.add_project(project, metrics_tags=project_metrics_tags)

            return env

    def add_project(self, project, is_hidden=None, metrics_tags=None):
        cache_key = f"envproj:c:{self.id}:{project.id}"

        if cache.get(cache_key) is None:
            _, created = EnvironmentProject.objects.get_or_create(
                project=project, environment=self, defaults={"is_hidden": is_hidden}
            )
            # The object already exists, we cache the action to reduce the load on the database.
            cache.set(cache_key, 1, 3600)
            if metrics_tags is not None:
                metrics_tags[DATA_ACCESS_TAG] = (
                    DataAccessTagValues.DB_CREATE.value
                    if created
                    else DataAccessTagValues.DB_READ.value
                )
        elif metrics_tags is not None:
            metrics_tags[DATA_ACCESS_TAG] = DataAccessTagValues.CACHE_HIT.value

    @staticmethod
    def get_name_from_path_segment(segment):
        # In cases where the environment name is passed as a URL path segment,
        # the (case-sensitive) string "none" represents the empty string
        # environment name for historic reasons (see commit b09858f.) In all
        # other contexts (incl. request query string parameters), the empty
        # string should be used.
        return unquote(segment) if segment != "none" else ""
