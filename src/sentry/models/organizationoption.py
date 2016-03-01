"""
sentry.models.organizationoption
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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


class OrganizationOptionManager(BaseManager):
    def __init__(self, *args, **kwargs):
        super(OrganizationOptionManager, self).__init__(*args, **kwargs)
        self.__cache = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        # we cant serialize weakrefs
        d.pop('_OrganizationOptionManager__cache', None)
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
            organization__in=instances,
            key=key,
        )
        result = dict((i, None) for i in instances)
        for obj in queryset:
            result[instance_map[obj.organization_id]] = obj.value
        return result

    def get_value(self, organization, key, default=None):
        result = self.get_all_values(organization)
        return result.get(key, default)

    def unset_value(self, organization, key):
        self.filter(organization=organization, key=key).delete()
        self.reload_cache(organization.id)

    def set_value(self, organization, key, value):
        self.create_or_update(
            organization=organization,
            key=key,
            values={
                'value': value,
            },
        )
        self.reload_cache(organization.id)

    def get_all_values(self, organization):
        if isinstance(organization, models.Model):
            organization_id = organization.id
        else:
            organization_id = organization

        if organization_id not in self.__cache:
            cache_key = self._make_key(organization_id)
            result = cache.get(cache_key)
            if result is None:
                result = self.reload_cache(organization_id)
            else:
                self.__cache[organization_id] = result
        return self.__cache.get(organization_id, {})

    def clear_local_cache(self, **kwargs):
        self.__cache = {}

    def reload_cache(self, organization_id):
        cache_key = self._make_key(organization_id)
        result = dict(
            (i.key, i.value)
            for i in self.filter(organization=organization_id)
        )
        cache.set(cache_key, result)
        self.__cache[organization_id] = result
        return result

    def post_save(self, instance, **kwargs):
        self.reload_cache(instance.organization_id)

    def post_delete(self, instance, **kwargs):
        self.reload_cache(instance.organization_id)

    def contribute_to_class(self, model, name):
        super(OrganizationOptionManager, self).contribute_to_class(model, name)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)


class OrganizationOption(Model):
    """
    Organization options apply only to an instance of a organization.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    key: onboarding:complete
    value: { updated: datetime }
    """
    organization = FlexibleForeignKey('sentry.Organization')
    key = models.CharField(max_length=64)
    value = UnicodePickledObjectField()

    objects = OrganizationOptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationoptions'
        unique_together = (('organization', 'key',),)

    __repr__ = sane_repr('organization_id', 'key', 'value')
