from typing import TYPE_CHECKING

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields import PickledObjectField
from sentry.db.models.manager import OptionManager, ValidateFunction, Value
from sentry.models.projecttemplate import ProjectTemplate
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from .project_template_option import ProjectTemplateOption


class ProjectTemplateOptionManager(OptionManager["ProjectTemplateOption"]):
    def get_value(
        self,
        project_template: ProjectTemplate | int,
        key: str,
        default: Value = None,
        validate: ValidateFunction | None = None,
    ) -> Value:
        result = self.get_all_values(project_template)

        if key in result:
            if validate is None or validate(result[key]):
                return result[key]

    def unset_value(self, project_template: ProjectTemplate, key: str, value: Value) -> None:
        self.filter(project_template=project_template, key=key).delete()
        self.reload_cache(project_template.id, "projecttemplateoption.unset_value")

    def set_value(self, project_template: ProjectTemplate, key: str, value: Value) -> bool:
        inst, created = self.get_or_create(
            project_template=project_template, key=key, values={"value": value}
        )
        self.reload_cache(project_template.id, "projecttemplateoption.set_value")

        return created or inst > 0

    def update_value(self, project_template_id: int, key: str, value: Value) -> None:
        self.update_value(project_template_id=project_template_id, key=key, value=value)
        self.reload_cache(project_template_id, "projecttemplateoption.update_value")

    def get_all_values(
        self, project_template: ProjectTemplate | int
    ) -> list[ProjectTemplateOption]:
        if isinstance(project_template, models.Model):
            project_template_id = project_template.id
        else:
            project_template_id = project_template

        cache_key = self._make_key(project_template_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)

            if result is None:
                self.reload_cache(project_template_id, "projecttemplateoption.get_all_values")
            else:
                self._option_cache[cache_key] = result

        return self._option_cache.get(cache_key, {})

    def reload_cache(self, project_template_id: int, update_reason: str) -> None:
        cache_key = self._make_key(project_template_id)

        result = {i.key: i.value for i in self.filter(project_template=project_template_id)}

        cache.set(cache_key, result)
        self._option_cache[cache_key] = result


@region_silo_model
class ProjectTemplateOption(Model):
    """
    A ProjectTemplateOption is a templated version of a project

    It is used to store the values that are shared between different
    projects across the organization.
    """

    __relocation_scope__ = RelocationScope.Organization

    project_template = FlexibleForeignKey("sentry.ProjectTemplate", related_name="options")
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projecttemplateoption"
        unique_together = (("project_template", "key"),)

    __repr__ = sane_repr("project_template_id", "key", "value")
