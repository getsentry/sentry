from __future__ import absolute_import, print_function

from django.db import models

from sentry import projectoptions
from sentry.db.models import Model, FlexibleForeignKey, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import OptionManager
from sentry.utils.cache import cache


class ProjectOptionManager(OptionManager):
    def get_value_bulk(self, instances, key):
        instance_map = dict((i.id, i) for i in instances)
        queryset = self.filter(project__in=instances, key=key)
        result = dict((i, None) for i in instances)
        for obj in queryset:
            result[instance_map[obj.project_id]] = obj.value
        return result

    def get_value(self, project, key, default=None, validate=None):
        result = self.get_all_values(project)
        if key in result:
            if validate is None or validate(result[key]):
                return result[key]
        if default is None:
            well_known_key = projectoptions.lookup_well_known_key(key)
            if well_known_key is not None:
                return well_known_key.get_default(project)
        return default

    def unset_value(self, project, key):
        self.filter(project=project, key=key).delete()
        self.reload_cache(project.id)

    def set_value(self, project, key, value):
        inst, created = self.create_or_update(project=project, key=key, values={"value": value})
        self.reload_cache(project.id)
        return created or inst > 0

    def get_all_values(self, project):
        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project
        cache_key = self._make_key(project_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)
            if result is None:
                result = self.reload_cache(project_id)
            else:
                self._option_cache[cache_key] = result
        return self._option_cache.get(cache_key, {})

    def reload_cache(self, project_id):
        cache_key = self._make_key(project_id)
        result = dict((i.key, i.value) for i in self.filter(project=project_id))
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        return result

    def post_save(self, instance, **kwargs):
        self.reload_cache(instance.project_id)

    def post_delete(self, instance, **kwargs):
        self.reload_cache(instance.project_id)


class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __core__ = True

    project = FlexibleForeignKey("sentry.Project")
    key = models.CharField(max_length=64)
    value = EncryptedPickledObjectField()

    objects = ProjectOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectoptions"
        unique_together = (("project", "key"),)

    __repr__ = sane_repr("project_id", "key", "value")
