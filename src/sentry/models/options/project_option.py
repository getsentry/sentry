from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Sequence

from django.db import models

from sentry import projectoptions
from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import OptionManager, ValidateFunction, Value
from sentry.tasks.relay import schedule_update_config_cache
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models import Project


class ProjectOptionManager(OptionManager["Project"]):
    def get_value_bulk(self, instances: Sequence[Project], key: str) -> Mapping[Project, Any]:
        instance_map = {i.id: i for i in instances}
        queryset = self.filter(project__in=instances, key=key)
        result = {i: None for i in instances}
        for obj in queryset:
            result[instance_map[obj.project_id]] = obj.value
        return result

    def get_value(
        self,
        project: Project,
        key: str,
        default: Value | None = None,
        validate: ValidateFunction | None = None,
    ) -> Any:
        result = self.get_all_values(project)
        if key in result:
            if validate is None or validate(result[key]):
                return result[key]
        if default is None:
            well_known_key = projectoptions.lookup_well_known_key(key)
            if well_known_key is not None:
                return well_known_key.get_default(project)
        return default

    def unset_value(self, project: Project, key: str) -> None:
        self.filter(project=project, key=key).delete()
        self.reload_cache(project.id, "projectoption.unset_value")

    def set_value(self, project: Project, key: str, value: Value) -> bool:
        inst, created = self.create_or_update(project=project, key=key, values={"value": value})
        self.reload_cache(project.id, "projectoption.set_value")

        # Explicitly typing to satisfy mypy.
        success: bool = created or inst > 0
        return success

    def get_all_values(self, project: Project) -> Mapping[str, Value]:
        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project
        cache_key = self._make_key(project_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)
            if result is None:
                self.reload_cache(project_id, "projectoption.get_all_values")
            else:
                self._option_cache[cache_key] = result

        # Explicitly typing to satisfy mypy.
        values: Mapping[str, Value] = self._option_cache.get(cache_key, {})
        return values

    def reload_cache(self, project_id: int, update_reason: str) -> Mapping[str, Value]:
        if update_reason != "projectoption.get_all_values":
            schedule_update_config_cache(
                project_id=project_id, generate=True, update_reason=update_reason
            )
        cache_key = self._make_key(project_id)
        result = {i.key: i.value for i in self.filter(project=project_id)}
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        return result

    def post_save(self, instance: ProjectOption, **kwargs: Any) -> None:
        self.reload_cache(instance.project_id, "projectoption.post_save")

    def post_delete(self, instance: ProjectOption, **kwargs: Any) -> None:
        self.reload_cache(instance.project_id, "projectoption.post_delete")


class ProjectOption(Model):  # type: ignore
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project")
    key = models.CharField(max_length=64)
    value = EncryptedPickledObjectField()

    objects = ProjectOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectoptions"
        unique_together = (("project", "key"),)

    __repr__ = sane_repr("project_id", "key", "value")
