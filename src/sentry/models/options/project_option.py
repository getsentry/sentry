from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from functools import partial
from typing import TYPE_CHECKING, Any, ClassVar

from django.db import models, router, transaction

from sentry import projectoptions
from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model, sane_repr
from sentry.db.models.fields.jsonfield import LegacyTextJSONField
from sentry.db.models.manager.option import OptionManager
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.project import Project

# Explicitly allow options that are safe to return in project-list responses.
# Internal options, including credentials, belong only in OPTION_KEYS below.
EXPOSED_OPTION_KEYS = frozenset(
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
        "sentry:enable_native_source_server_mapping",
        "sentry:sensitive_fields",
        "sentry:highlight_tags",
        "sentry:highlight_context",
        "sentry:csp_ignored_sources_defaults",
        "sentry:csp_ignored_sources",
        "sentry:default_environment",
        "sentry:blacklisted_ips",
        "sentry:releases",
        "sentry:error_messages",
        "sentry:log_messages",
        "sentry:trace_metric_names",
        "sentry:scrape_javascript",
        "sentry:replay_hydration_error_issues",
        "sentry:replay_rage_click_issues",
        "sentry:feedback_user_report_notifications",
        "sentry:feedback_ai_spam_detection",
        "sentry:enable_auto_release_creation",
        "sentry:toolbar_allowed_origins",
        "sentry:relay_automatic_json_expansion",
        "sentry:token_header",
        "sentry:verify_ssl",
        "sentry:scrub_ip_address",
        "sentry:grouping_config",
        "sentry:grouping_enhancements",
        "sentry:derived_grouping_enhancements",
        "sentry:secondary_grouping_config",
        "sentry:secondary_grouping_expiry",
        "sentry:similarity_backfill_completed",
        "sentry:group_action_log_backfill_completed",
        "sentry:fingerprinting_rules",
        "sentry:relay_pii_config",
        "sentry:dynamic_sampling",
        "sentry:dynamic_sampling_biases",
        "sentry:target_sample_rate",
        "sentry:tempest_fetch_screenshots",
        "sentry:breakdowns",
        "sentry:transaction_name_cluster_rules",
        "sentry:uptime_autodetection",
        "sentry:autofix_automation_tuning",
        "sentry:seer_scanner_automation",
        "sentry:seer_nightshift_tweaks",
        "sentry:debug_files_role",
        "sentry:preprod_size_status_checks_enabled",
        "sentry:preprod_size_status_checks_rules",
        "sentry:preprod_size_pr_comments_enabled",
        "sentry:preprod_size_pr_comments_rules",
        "sentry:preprod_size_enabled_query",
        "sentry:preprod_distribution_enabled_query",
        "sentry:preprod_size_enabled_by_customer",
        "sentry:preprod_distribution_enabled_by_customer",
        "sentry:preprod_snapshot_status_checks_enabled",
        "sentry:preprod_snapshot_status_checks_fail_on_added",
        "sentry:preprod_snapshot_status_checks_fail_on_removed",
        "sentry:preprod_snapshot_status_checks_fail_on_changed",
        "sentry:preprod_snapshot_status_checks_fail_on_renamed",
        "sentry:preprod_distribution_pr_comments_enabled_by_customer",
        "sentry:preprod_snapshot_pr_comments_enabled",
        "sentry:preprod_snapshot_pr_comments_post_on_added",
        "sentry:preprod_snapshot_pr_comments_post_on_removed",
        "sentry:preprod_snapshot_pr_comments_post_on_changed",
        "sentry:preprod_snapshot_pr_comments_post_on_renamed",
        "sentry:scm_source_context_enabled",
        "quotas:spike-protection-disabled",
        "feedback:branding",
        "digests:mail:minimum_delay",
        "digests:mail:maximum_delay",
        "mail:subject_prefix",
        "mail:subject_template",
        "filters:react-hydration-errors",
        "filters:chunk-load-error",
    ]
)

OPTION_KEYS = EXPOSED_OPTION_KEYS | {"sentry:symbol_sources", "sentry:token"}


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
        self.reload_cache(project.id, "projectoption.unset_value", key)

    def set_value(self, project: int | Project, key: str, value: Any) -> bool:
        """
        Sets a project option for the given project.
        """

        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project

        is_value_changed = False
        using = self._db or router.db_for_write(self.model)
        with transaction.atomic(using=using):
            # select_for_update lock rows until the end of the transaction
            obj, created = (
                self.using(using)
                .select_for_update()
                .get_or_create(project_id=project_id, key=key, defaults={"value": value})
            )
            if created:
                is_value_changed = True
            elif obj.value != value:
                # update the value via ORM update() to avoid post save signals which
                # might cause cache reload when it is not needed (e.g. post_save signal)
                self.using(using).filter(id=obj.id).update(value=value)
                is_value_changed = True

        if is_value_changed:
            self.reload_cache(project_id, "projectoption.set_value", key, using=using)

        return is_value_changed

    def get_all_values(self, project: Project | int) -> Mapping[str, Any]:
        if isinstance(project, models.Model):
            project_id = project.id
        else:
            project_id = project
        using = self._db or router.db_for_write(self.model)
        connection = transaction.get_connection(using)
        # Inspect state without opening a database connection for a cache hit.
        if connection.in_atomic_block or (
            connection.connection is not None and not connection.autocommit
        ):
            # Read our own writes without exposing data that a savepoint or the
            # enclosing transaction can still roll back to either cache.
            return self._get_values_from_database(project_id, using)
        cache_key = self._make_key(project_id)

        if cache_key not in self._option_cache:
            result = cache.get(cache_key)
            if result is None:
                self.reload_cache(project_id, "projectoption.get_all_values")
            else:
                self._option_cache[cache_key] = result

        return self._option_cache.get(cache_key, {})

    def reload_cache(
        self,
        project_id: int,
        update_reason: str,
        option_key: str | None = None,
        *,
        using: str | None = None,
    ) -> Mapping[str, Any]:
        using = using or self._db or router.db_for_write(self.model)
        connection = transaction.get_connection(using)
        if not connection.get_autocommit():
            self._option_cache.pop(self._make_key(project_id), None)
            # Register inside an atomic block so this also works when a caller
            # manages autocommit manually. Rollback discards the callback.
            with transaction.atomic(using=using, savepoint=False):
                transaction.on_commit(
                    partial(self._reload_cache, project_id, update_reason, option_key, using),
                    using=using,
                )
            return self._get_values_from_database(project_id, using)

        return self._reload_cache(project_id, update_reason, option_key, using)

    def _get_values_from_database(self, project_id: int, using: str) -> dict[str, Any]:
        return dict(self.using(using).filter(project_id=project_id).values_list("key", "value"))

    def _reload_cache(
        self, project_id: int, update_reason: str, option_key: str | None, using: str
    ) -> Mapping[str, Any]:
        from sentry.tasks.relay import schedule_invalidate_project_config

        # Query when the callback runs, rather than publishing a snapshot taken
        # before commit (which may include writes rolled back to a savepoint).
        cache_key = self._make_key(project_id)
        result = self._get_values_from_database(project_id, using)
        cache.set(cache_key, result)
        self._option_cache[cache_key] = result
        if update_reason != "projectoption.get_all_values":
            schedule_invalidate_project_config(
                project_id=project_id,
                trigger=update_reason,
                trigger_details=option_key,
                transaction_db=using,
            )
        return result

    def post_save(self, *, instance: ProjectOption, created: bool, **kwargs: object) -> None:
        using = kwargs.get("using")
        assert using is None or isinstance(using, str)
        self.reload_cache(
            instance.project_id, "projectoption.post_save", option_key=instance.key, using=using
        )

    def post_delete(self, instance: ProjectOption, using: str | None = None, **kwargs: Any) -> None:
        self.reload_cache(
            instance.project_id, "projectoption.post_delete", option_key=instance.key, using=using
        )

    def isset(self, project: Project, key: str) -> bool:
        return self.get_value(project, key, default=Ellipsis) is not Ellipsis


@cell_silo_model
class ProjectOption(Model):
    """
    Project options apply only to an instance of a project.

    Options which are specific to a plugin should namespace
    their key. e.g. key='myplugin:optname'
    """

    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project")
    key = models.CharField(max_length=64)
    value = LegacyTextJSONField(null=True)

    objects: ClassVar[ProjectOptionManager] = ProjectOptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectoptions"
        unique_together = (("project", "key"),)
        indexes = [
            models.Index(fields=["key"]),
        ]

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


def get_option(
    project: int | Project,
    key: str,
    default: Any | None = None,
    validate: Callable[[object], bool] | None = None,
) -> Any:
    return ProjectOption.objects.get_value(project, key, default, validate)
