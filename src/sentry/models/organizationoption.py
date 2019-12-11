from __future__ import absolute_import, print_function

from django.db import models

from sentry.db.models import Model, FlexibleForeignKey, sane_repr
from sentry.db.models.fields import EncryptedPickledObjectField
from sentry.db.models.manager import OptionManager
from sentry.utils.cache import cache


class OrganizationOptionManager(OptionManager):
    def get_value_bulk(self, instances, key):
        instance_map = dict((i.id, i) for i in instances)
        queryset = self.filter(organization__in=instances, key=key)
        result = dict((i, None) for i in instances)
        for obj in queryset:
            result[instance_map[obj.organization_id]] = obj.value
        return result

    def get_value(self, organization, key, default=None):
        result = self.get_all_values(organization)
        return result.get(key, default)

    def unset_value(self, organization, key):
        try:
            inst = self.get(organization=organization, key=key)
        except self.model.DoesNotExist:
            return
        inst.delete()
        self.reload_cache(organization.id)

    def set_value(self, organization, key, value):
        self.create_or_update(organization=organization, key=key, values={"value": value})
        self.reload_cache(organization.id)

    def get_all_values(self, organization):
        if isinstance(organization, models.Model):
            organization_id = organization.id
        else:
            organization_id = organization
        cache_key = self._make_key(organization_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)
            if result is None:
                result = self.reload_cache(organization_id)
            else:
                self._option_cache[cache_key] = result
        return self._option_cache.get(cache_key, {})

    def reload_cache(self, organization_id):
        cache_key = self._make_key(organization_id)
        result = dict((i.key, i.value) for i in self.filter(organization=organization_id))
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        return result

    def post_save(self, instance, **kwargs):
        self.reload_cache(instance.organization_id)

    def post_delete(self, instance, **kwargs):
        self.reload_cache(instance.organization_id)


class OrganizationOption(Model):
    """
    Organization options apply only to an instance of a organization.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    key: onboarding:complete
    value: { updated: datetime }
    """

    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    key = models.CharField(max_length=64)
    value = EncryptedPickledObjectField()

    objects = OrganizationOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationoptions"
        unique_together = (("organization", "key"),)

    __repr__ = sane_repr("organization_id", "key", "value")
