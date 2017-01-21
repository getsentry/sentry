"""
sentry.models.projectoption
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from celery.signals import task_postrun
from django.core.signals import request_finished
from django.db import models

from sentry.db.models import Model, FlexibleForeignKey, sane_repr
from sentry.db.models.fields import UnicodePickledObjectField
from sentry.db.models.manager import BaseManager
from sentry.utils.cache import cache


class ProjectOptionManager(BaseManager):
    def __init__(self, *args, **kwargs):
        super(ProjectOptionManager, self).__init__(*args, **kwargs)
        self.__cache = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_ProjectOptionManager__cache', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__cache = {}

    def _make_key(self, instance_id):
        assert instance_id
        return '%s:%s' % (self.model._meta.db_table, instance_id)

    def get_value_bulk(self, instances, key):
        instance_map = dict((i.id, i) for i in instances)
        queryset = self.filter(
            project__in=instances,
            key=key,
        )
        result = dict((i, None) for i in instances)
        for obj in queryset:
            result[instance_map[obj.project_id]] = obj.value
        return result

    def get_value(self, project, key, default=None):
        result = self.get_all_values(project)
        return result.get(key, default)

    def unset_value(self, project, key):
        self.filter(project=project, key=key).delete()
        self.reload_cache(project.id)

    def set_value(self, project, key, value):
        self.create_or_update(
            project=project,
            key=key,
            values={
                'value': value,
            },
        )
        self.reload_cache(project.id)

    def get_all_values(self, project):
        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project

        if project_id not in self.__cache:
            cache_key = self._make_key(project_id)
            result = cache.get(cache_key)
            if result is None:
                result = self.reload_cache(project_id)
            else:
                self.__cache[project_id] = result
        return self.__cache.get(project_id, {})

    def clear_local_cache(self, **kwargs):
        self.__cache = {}

    def reload_cache(self, project_id):
        cache_key = self._make_key(project_id)
        result = dict(
            (i.key, i.value)
            for i in self.filter(project=project_id)
        )
        cache.set(cache_key, result)
        self.__cache[project_id] = result
        return result

    def post_save(self, instance, **kwargs):
        self.reload_cache(instance.project_id)

    def post_delete(self, instance, **kwargs):
        self.reload_cache(instance.project_id)

    def contribute_to_class(self, model, name):
        super(ProjectOptionManager, self).contribute_to_class(model, name)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)


class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """
    __core__ = True

    project = FlexibleForeignKey('sentry.Project')
    key = models.CharField(max_length=64)
    value = UnicodePickledObjectField()

    objects = ProjectOptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectoptions'
        unique_together = (('project', 'key',),)

    __repr__ = sane_repr('project_id', 'key', 'value')
