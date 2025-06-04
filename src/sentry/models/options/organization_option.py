from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TYPE_CHECKING, Any, ClassVar

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields.picklefield import PickledObjectField
from sentry.db.models.manager.option import OptionManager
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class OrganizationOptionManager(OptionManager["OrganizationOption"]):
    def get_value_bulk(
        self, instances: Sequence[Organization], key: str, default: Any = None
    ) -> Mapping[Organization, Any]:
        instance_map = {i.id: i for i in instances}
        queryset = self.filter(organization__in=instances, key=key)
        result = {i: default for i in instances}
        for obj in queryset:
            result[instance_map[obj.organization_id]] = obj.value
        return result

    def get_value_bulk_id(
        self, ids: Sequence[int], key: str, default: Any = None
    ) -> Mapping[int, Any]:
        queryset = self.filter(organization_id__in=ids, key=key)
        result = {i: default for i in ids}
        for obj in queryset:
            result[obj.organization_id] = obj.value
        return result

    def get_value(
        self,
        organization: Organization,
        key: str,
        default: Any | None = None,
        validate: Callable[[object], bool] | None = None,
    ) -> Any:
        result = self.get_all_values(organization)
        return result.get(key, default)

    def unset_value(self, organization: Organization, key: str) -> None:
        try:
            inst = self.get(organization=organization, key=key)
        except self.model.DoesNotExist:
            return
        inst.delete()
        self.reload_cache(organization.id, "organizationoption.unset_value")

    def set_value(self, organization: Organization, key: str, value: Any) -> bool:
        inst, created = self.create_or_update(
            organization=organization, key=key, values={"value": value}
        )
        self.reload_cache(organization.id, "organizationoption.set_value")
        return bool(created) or inst > 0

    def get_all_values(self, organization: Organization | int) -> Mapping[str, Any]:
        if isinstance(organization, models.Model):
            organization_id = organization.id
        else:
            organization_id = organization
        cache_key = self._make_key(organization_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)
            if result is None:
                self.reload_cache(organization_id, "organizationoption.get_all_values")
            else:
                self._option_cache[cache_key] = result

        return self._option_cache.get(cache_key, {})

    def reload_cache(self, organization_id: int, update_reason: str) -> Mapping[str, Any]:
        from sentry.tasks.relay import schedule_invalidate_project_config

        if update_reason != "organizationoption.get_all_values":
            schedule_invalidate_project_config(
                organization_id=organization_id, trigger=update_reason
            )

        cache_key = self._make_key(organization_id)
        result = {i.key: i.value for i in self.filter(organization=organization_id)}
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        return result

    def post_save(self, *, instance: OrganizationOption, created: bool, **kwargs: object) -> None:
        self.reload_cache(instance.organization_id, "organizationoption.post_save")

    def post_delete(self, instance: OrganizationOption, **kwargs: Any) -> None:
        self.reload_cache(instance.organization_id, "organizationoption.post_delete")


@region_silo_model
class OrganizationOption(Model):
    """
    Organization options apply only to an instance of a organization.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'

    key: onboarding:complete
    value: { updated: datetime }
    """

    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects: ClassVar[OrganizationOptionManager] = OrganizationOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationoptions"
        unique_together = (("organization", "key"),)

    __repr__ = sane_repr("organization_id", "key", "value")
