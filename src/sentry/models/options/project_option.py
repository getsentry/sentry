from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TYPE_CHECKING, Any, ClassVar

from django.db import models

from sentry import projectoptions
from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr
from sentry.db.models.fields import PickledObjectField
from sentry.db.models.manager.option import OptionManager
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.project import Project

OPTION_KEYS = frozenset(
    [
        # we need the epoch to fill in the defaults correctly
        "sentry:option-epoch",
        "sentry:origins",
        "sentry:resolve_age",
        "sentry:scrub_data",
        "sentry:scrub_defaults",
        "sentry:safe_fields",
        "sentry:store_crash_reports",
        "sentry:builtin_symbol_sources",
        "sentry:symbol_sources",
        "sentry:sensitive_fields",
        "sentry:highlight_tags",
        "sentry:highlight_context",
        "sentry:csp_ignored_sources_defaults",
        "sentry:csp_ignored_sources",
        "sentry:default_environment",
        "sentry:blacklisted_ips",
        "sentry:releases",
        "sentry:error_messages",
        "sentry:scrape_javascript",
        "sentry:replay_hydration_error_issues",
        "sentry:replay_rage_click_issues",
        "sentry:feedback_user_report_notifications",
        "sentry:feedback_ai_spam_detection",
        "sentry:toolbar_allowed_origins",
        "sentry:token",
        "sentry:token_header",
        "sentry:verify_ssl",
        "sentry:scrub_ip_address",
        "sentry:grouping_config",
        "sentry:grouping_enhancements",
        "sentry:grouping_enhancements_base",
        "sentry:secondary_grouping_config",
        "sentry:secondary_grouping_expiry",
        "sentry:similarity_backfill_completed",
        "sentry:fingerprinting_rules",
        "sentry:relay_pii_config",
        "sentry:dynamic_sampling",
        "sentry:dynamic_sampling_biases",
        "sentry:target_sample_rate",
        "sentry:tempest_fetch_screenshots",
        "sentry:tempest_fetch_dumps",
        "sentry:breakdowns",
        "sentry:transaction_name_cluster_rules",
        "sentry:uptime_autodetection",
        "quotas:spike-protection-disabled",
        "feedback:branding",
        "digests:mail:minimum_delay",
        "digests:mail:maximum_delay",
        "mail:subject_prefix",
        "mail:subject_template",
        "filters:react-hydration-errors",
        "filters:chunk-load-error",
        "relay.cardinality-limiter.limits",
    ]
)


class ProjectOptionManager(OptionManager["ProjectOption"]):
    def get_value_bulk(self, instances: Sequence[Project], key: str) -> Mapping[Project, Any]:
        instance_map = {i.id: i for i in instances}
        queryset = self.filter(project__in=instances, key=key)
        result = {i: None for i in instances}
        for obj in queryset:
            result[instance_map[obj.project_id]] = obj.value
        return result

    def get_value_bulk_id(self, ids: Sequence[int], key: str) -> Mapping[int, Any]:
        queryset = self.filter(project_id__in=ids, key=key)
        result = {i: None for i in ids}
        for obj in queryset:
            result[obj.project_id] = obj.value
        return result

    def get_value(
        self,
        project: int | Project,
        key: str,
        default: Any | None = None,
        validate: Callable[[object], bool] | None = None,
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

    def set_value(self, project: int | Project, key: str, value: Any) -> bool:
        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project

        inst, created = self.create_or_update(
            project_id=project_id, key=key, values={"value": value}
        )
        self.reload_cache(project_id, "projectoption.set_value")

        return created or inst > 0

    def get_all_values(self, project: Project | int) -> Mapping[str, Any]:
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

        return self._option_cache.get(cache_key, {})

    def reload_cache(self, project_id: int, update_reason: str) -> Mapping[str, Any]:
        from sentry.tasks.relay import schedule_invalidate_project_config

        if update_reason != "projectoption.get_all_values":
            schedule_invalidate_project_config(project_id=project_id, trigger=update_reason)
        cache_key = self._make_key(project_id)
        result = {i.key: i.value for i in self.filter(project=project_id)}
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        return result

    def post_save(self, *, instance: ProjectOption, created: bool, **kwargs: object) -> None:
        self.reload_cache(instance.project_id, "projectoption.post_save")

    def post_delete(self, instance: ProjectOption, **kwargs: Any) -> None:
        self.reload_cache(instance.project_id, "projectoption.post_delete")

    def isset(self, project: Project, key: str) -> bool:
        return self.get_value(project, key, default=Ellipsis) is not Ellipsis


@region_silo_model
class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    key = models.CharField(max_length=64)
    value = PickledObjectField()

    objects: ClassVar[ProjectOptionManager] = ProjectOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectoptions"
        unique_together = (("project", "key"),)

    __repr__ = sane_repr("project_id", "key", "value")

    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # Some `ProjectOption`s for the project are automatically generated at insertion time via a
        # `post_save()` hook, so they should already exist with autogenerated data. We simply need
        # to update them with the correct, imported values here.
        (option, _) = self.__class__.objects.get_or_create(
            project=self.project, key=self.key, defaults={"value": self.value}
        )
        if option:
            self.pk = option.pk
            self.save()

        return (self.pk, ImportKind.Inserted)
