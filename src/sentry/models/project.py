from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Collection, Iterable, Mapping
from typing import TYPE_CHECKING, Any, ClassVar
from uuid import uuid1

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, models, router, transaction
from django.db.models import Q, QuerySet, Subquery
from django.db.models.signals import pre_delete
from django.utils import timezone
from django.utils.http import urlencode
from django.utils.translation import gettext_lazy as _

from bitfield import TypedClassBitField
from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import PROJECT_SLUG_MAX_LENGTH, RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.db.mixin import PendingDeletionMixin, delete_pending_deletion_option
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.slug import SentrySlugField
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.utils import slugify_instance
from sentry.hybridcloud.models.outbox import RegionOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.locks import locks
from sentry.models.grouplink import GroupLink
from sentry.models.team import Team
from sentry.monitors.models import MonitorEnvironment, MonitorStatus
from sentry.notifications.services import notifications_service
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.colors import get_hashed_color
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snowflake import save_with_snowflake_id, snowflake_id_model

if TYPE_CHECKING:
    from sentry.models.options.project_option import ProjectOptionManager
    from sentry.models.options.project_template_option import ProjectTemplateOptionManager
    from sentry.users.models.user import User

SENTRY_USE_SNOWFLAKE = getattr(settings, "SENTRY_USE_SNOWFLAKE", False)

# NOTE:
# - When you modify this list, ensure that the platform IDs listed in "sentry/static/app/data/platforms.tsx" match.
# - Please keep this list organized alphabetically.
GETTING_STARTED_DOCS_PLATFORMS = [
    "android",
    "apple",
    "apple-ios",
    "apple-macos",
    "bun",
    "capacitor",
    "cloudflare-pages",
    "cloudflare-workers",
    "cordova",
    "dart",
    "deno",
    "dotnet",
    "dotnet-aspnet",
    "dotnet-aspnetcore",
    "dotnet-awslambda",
    "dotnet-gcpfunctions",
    "dotnet-maui",
    "dotnet-uwp",
    "dotnet-winforms",
    "dotnet-wpf",
    "dotnet-xamarin",
    "electron",
    "elixir",
    "flutter",
    "go",
    "go-echo",
    "go-fasthttp",
    "go-fiber",
    "go-gin",
    "go-http",
    "go-iris",
    "go-martini",
    "go-negroni",
    "ionic",
    "java",
    "java-log4j2",
    "java-logback",
    "java-spring",
    "java-spring-boot",
    "javascript",
    "javascript-angular",
    "javascript-astro",
    "javascript-ember",
    "javascript-gatsby",
    "javascript-nextjs",
    "javascript-react",
    "javascript-remix",
    "javascript-solid",
    "javascript-solidstart",
    "javascript-svelte",
    "javascript-sveltekit",
    "javascript-nuxt",
    "javascript-vue",
    "kotlin",
    "minidump",
    "native",
    "native-qt",
    "nintendo-switch",
    "node",
    "node-awslambda",
    "node-azurefunctions",
    "node-connect",
    "node-express",
    "node-fastify",
    "node-gcpfunctions",
    "node-hapi",
    "node-koa",
    "node-nestjs",
    "php",
    "php-laravel",
    "php-symfony",
    "powershell",
    "python",
    "python-aiohttp",
    "python-asgi",
    "python-awslambda",
    "python-bottle",
    "python-celery",
    "python-chalice",
    "python-django",
    "python-falcon",
    "python-fastapi",
    "python-flask",
    "python-gcpfunctions",
    "python-pylons",
    "python-pymongo",
    "python-pyramid",
    "python-quart",
    "python-rq",
    "python-sanic",
    "python-serverless",
    "python-starlette",
    "python-tornado",
    "python-tryton",
    "python-wsgi",
    "react-native",
    "ruby",
    "ruby-rack",
    "ruby-rails",
    "rust",
    "unity",
    "unreal",
]


class ProjectManager(BaseManager["Project"]):
    def get_by_users(self, users: Iterable[User | RpcUser]) -> Mapping[int, Iterable[int]]:
        """Given a list of users, return a mapping of each user to the projects they are a member of."""
        project_rows = self.filter(
            projectteam__team__organizationmemberteam__is_active=True,
            projectteam__team__organizationmemberteam__organizationmember__user_id__in=map(
                lambda u: u.id, users
            ),
        ).values_list(
            "id", "projectteam__team__organizationmemberteam__organizationmember__user_id"
        )

        projects_by_user_id = defaultdict(set)
        for project_id, user_id in project_rows:
            if user_id is not None:
                projects_by_user_id[user_id].add(project_id)
        return projects_by_user_id

    def get_for_user_ids(self, user_ids: Collection[int]) -> QuerySet:
        """Returns the QuerySet of all projects that a set of Users have access to."""
        return self.filter(
            status=ObjectStatus.ACTIVE,
            teams__organizationmember__user_id__in=user_ids,
        )

    def get_for_team_ids(self, team_ids: Collection[int] | Subquery) -> QuerySet:
        """Returns the QuerySet of all projects that a set of Teams have access to."""
        return self.filter(status=ObjectStatus.ACTIVE, teams__in=team_ids)

    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, scope=None, _skip_team_check=False):
        from sentry.models.team import Team

        if not (user and user.is_authenticated):
            return []

        if not _skip_team_check:
            team_list = Team.objects.get_for_user(
                organization=team.organization, user=user, scope=scope
            )

            try:
                team = team_list[team_list.index(team)]
            except ValueError:
                logging.info("User does not have access to team: %s", team.id)
                return []

        base_qs = self.filter(teams=team, status=ObjectStatus.ACTIVE)

        project_list = []
        for project in base_qs:
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())


@snowflake_id_model
@region_silo_model
class Project(Model, PendingDeletionMixin):
    from sentry.models.projectteam import ProjectTeam

    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """

    __relocation_scope__ = RelocationScope.Organization

    slug = SentrySlugField(null=True, max_length=PROJECT_SLUG_MAX_LENGTH)
    # DEPRECATED do not use, prefer slug
    name = models.CharField(max_length=200)
    forced_color = models.CharField(max_length=6, null=True, blank=True)
    organization = FlexibleForeignKey("sentry.Organization")
    teams = models.ManyToManyField("sentry.Team", related_name="teams", through=ProjectTeam)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ObjectStatus.ACTIVE, _("Active")),
            (ObjectStatus.PENDING_DELETION, _("Pending Deletion")),
            (ObjectStatus.DELETION_IN_PROGRESS, _("Deletion in Progress")),
        ),
        db_index=True,
    )
    # projects that were created before this field was present
    # will have their first_event field set to date_added
    first_event = models.DateTimeField(null=True)
    template = FlexibleForeignKey("sentry.ProjectTemplate", null=True)

    class flags(TypedClassBitField):
        # WARNING: Only add flags to the bottom of this list
        # bitfield flags are dependent on their order and inserting/removing
        # flags from the middle of the list will cause bits to shift corrupting
        # existing data.

        # This Project has sent release data
        has_releases: bool
        # This Project has issue alerts targeting
        has_issue_alerts_targeting: bool

        # This Project has sent transactions
        has_transactions: bool

        # This Project has filters
        has_alert_filters: bool

        # This Project has sessions
        has_sessions: bool

        # This Project has sent profiles
        has_profiles: bool

        # This Project has sent replays
        has_replays: bool

        # This project has sent feedbacks
        has_feedbacks: bool

        # This project has sent new feedbacks, from the user-initiated widget
        has_new_feedbacks: bool

        # spike protection flags are DEPRECATED
        spike_protection_error_currently_active: bool
        spike_protection_transaction_currently_active: bool
        spike_protection_attachment_currently_active: bool

        # This Project has event with minified stack trace
        has_minified_stack_trace: bool

        # This Project has cron monitors
        has_cron_monitors: bool

        # This Project has sent check-ins
        has_cron_checkins: bool

        # This Project has event with sourcemaps
        has_sourcemaps: bool

        # This Project has custom metrics
        has_custom_metrics: bool

        # This Project has enough issue volume to use high priority alerts
        has_high_priority_alerts: bool

        # This Project has sent insight request spans
        has_insights_http: bool

        # This Project has sent insight db spans
        has_insights_db: bool

        # This Project has sent insight assets spans
        has_insights_assets: bool

        # This Project has sent insight app starts spans
        has_insights_app_start: bool

        # This Project has sent insight screen load spans
        has_insights_screen_load: bool

        # This Project has sent insight vitals spans
        has_insights_vitals: bool

        # This Project has sent insight caches spans
        has_insights_caches: bool

        # This Project has sent insight queues spans
        has_insights_queues: bool

        # This Project has sent insight llm monitoring spans
        has_insights_llm_monitoring: bool

        # This Project has sent feature flags
        has_flags: bool

        bitfield_default = 10
        bitfield_null = True

    objects: ClassVar[ProjectManager] = ProjectManager(cache_fields=["pk"])
    platform = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_project"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("team_id", "name", "slug", "organization_id")

    _rename_fields_on_pending_delete = frozenset(["slug"])

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def next_short_id(self, delta: int = 1) -> int:
        from sentry.models.counter import Counter

        with (
            sentry_sdk.start_span(op="project.next_short_id") as span,
            metrics.timer("project.next_short_id"),
        ):
            span.set_data("project_id", self.id)
            span.set_data("project_slug", self.slug)
            return Counter.increment(self, delta)

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get(
                f"slug:project:{self.organization_id}", duration=5, name="project_slug"
            )
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(
                    self,
                    self.name,
                    organization=self.organization,
                    reserved=RESERVED_PROJECT_SLUGS,
                    max_length=50,
                )

        if SENTRY_USE_SNOWFLAKE:
            snowflake_redis_key = "project_snowflake_key"
            save_with_snowflake_id(
                instance=self,
                snowflake_redis_key=snowflake_redis_key,
                save_callback=lambda: super(Project, self).save(*args, **kwargs),
            )
        else:
            super().save(*args, **kwargs)

    def get_absolute_url(self, params=None):
        path = f"/organizations/{self.organization.slug}/issues/"
        params = {} if params is None else params
        params["project"] = self.id
        query = None
        if params:
            query = urlencode(params)
        return self.organization.absolute_url(path, query=query)

    def is_internal_project(self):
        for value in (settings.SENTRY_FRONTEND_PROJECT, settings.SENTRY_PROJECT):
            if str(self.id) == str(value) or str(self.slug) == str(value):
                return True
        return False

    @property
    def option_manager(self) -> ProjectOptionManager:
        from sentry.models.options.project_option import ProjectOption

        return ProjectOption.objects

    @property
    def template_manager(self) -> ProjectTemplateOptionManager:
        from sentry.models.options.project_template_option import ProjectTemplateOption

        return ProjectTemplateOption.objects

    def get_option(
        self, key: str, default: Any | None = None, validate: Callable[[object], bool] | None = None
    ) -> Any:
        # if the option is not set, check the template
        if not self.option_manager.isset(self, key) and self.template is not None:
            return self.template_manager.get_value(self.template, key, default, validate)

        return self.option_manager.get_value(self, key, default, validate)

    def update_option(self, key: str, value: Any) -> bool:
        return self.option_manager.set_value(self, key, value)

    def delete_option(self, key: str) -> None:
        self.option_manager.unset_value(self, key)

    @property
    def color(self):
        if self.forced_color is not None:
            return f"#{self.forced_color}"
        assert self.slug is not None
        return get_hashed_color(self.slug.upper())

    @property
    def member_set(self):
        """:returns a QuerySet of all Users that belong to this Project"""
        from sentry.models.organizationmember import OrganizationMember

        return self.organization.member_set.filter(
            id__in=OrganizationMember.objects.filter(
                organizationmemberteam__is_active=True,
                organizationmemberteam__team__in=self.teams.all(),
            ).values("id"),
            user_is_active=True,
            user_id__isnull=False,
        ).distinct()

    def get_members_as_rpc_users(self) -> Iterable[RpcUser]:
        member_ids = self.member_set.values_list("user_id", flat=True)
        return user_service.get_many_by_id(ids=list(member_ids))

    def get_audit_log_data(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": self.status,
            "public": self.public,
        }

    def get_full_name(self):
        return self.slug

    def transfer_to(self, organization):
        from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.integrations.models.external_issue import ExternalIssue
        from sentry.models.environment import Environment, EnvironmentProject
        from sentry.models.projectteam import ProjectTeam
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
        from sentry.models.releases.release_project import ReleaseProject
        from sentry.models.rule import Rule
        from sentry.monitors.models import Monitor
        from sentry.snuba.models import SnubaQuery

        old_org_id = self.organization_id
        org_changed = old_org_id != organization.id

        self.organization = organization

        try:
            with transaction.atomic(router.db_for_write(Project)):
                self.update(organization=organization)
        except IntegrityError:
            slugify_instance(self, self.name, organization=organization, max_length=50)
            self.update(slug=self.slug, organization=organization)

        # Both environments and releases are bound at an organization level.
        # Due to this, when you transfer a project into another org, we have to
        # handle this behavior somehow. We really only have two options here:
        # * Copy over all releases/environments into the new org and handle de-duping
        # * Delete the bindings and let them reform with new data.
        # We're generally choosing to just delete the bindings since new data
        # flowing in will recreate links correctly. The tradeoff is that
        # historical data is lost, but this is a compromise we're willing to
        # take and a side effect of allowing this feature. There are exceptions
        # to this however, such as rules, which should maintain their
        # configuration when moved across organizations.
        if org_changed:
            for model in ReleaseProject, ReleaseProjectEnvironment, EnvironmentProject:
                model.objects.filter(project_id=self.id).delete()
            # this is getting really gross, but make sure there aren't lingering associations
            # with old orgs or teams
            ProjectTeam.objects.filter(project=self, team__organization_id=old_org_id).delete()

        rules_by_environment_id = defaultdict(set)
        for rule_id, environment_id in Rule.objects.filter(
            project_id=self.id, environment_id__isnull=False
        ).values_list("id", "environment_id"):
            assert environment_id is not None
            rules_by_environment_id[environment_id].add(rule_id)

        environment_names = dict(
            Environment.objects.filter(organization_id=old_org_id).values_list("id", "name")
        )

        for environment_id, rule_ids in rules_by_environment_id.items():
            Rule.objects.filter(id__in=rule_ids).update(
                environment_id=Environment.get_or_create(self, environment_names[environment_id]).id
            )

        # Manually move over organization id's for Monitors
        monitors = Monitor.objects.filter(organization_id=old_org_id, project_id=self.id)
        new_monitors = set(
            Monitor.objects.filter(organization_id=organization.id).values_list("slug", flat=True)
        )
        for monitor in monitors:
            if monitor.slug in new_monitors:
                RegionScheduledDeletion.schedule(monitor, days=0)
            else:
                for monitor_env_id, env_id in MonitorEnvironment.objects.filter(
                    monitor_id=monitor.id, status=MonitorStatus.ACTIVE
                ).values_list("id", "environment_id"):
                    MonitorEnvironment.objects.filter(id=monitor_env_id).update(
                        environment_id=Environment.get_or_create(
                            self, name=environment_names.get(env_id, None)
                        ).id
                    )
                monitor.update(organization_id=organization.id)

        # Remove alert owners not in new org
        alert_rules = AlertRule.objects.fetch_for_project(self).filter(
            Q(user_id__isnull=False) | Q(team_id__isnull=False)
        )
        for alert_rule in alert_rules:
            is_member = False
            if alert_rule.user_id:
                is_member = organization.member_set.filter(user_id=alert_rule.user_id).exists()
            if alert_rule.team_id:
                is_member = Team.objects.filter(
                    organization_id=organization.id, id=alert_rule.team_id
                ).exists()
            if not is_member:
                alert_rule.update(team_id=None, user_id=None)
        rule_models = Rule.objects.filter(
            Q(owner_team_id__isnull=False) | Q(owner_user_id__isnull=False), project=self
        )
        for rule_model in rule_models:
            is_member = False
            if rule_model.owner_user_id:
                is_member = organization.member_set.filter(
                    user_id=rule_model.owner_user_id
                ).exists()
            if rule_model.owner_team_id:
                is_member = Team.objects.filter(
                    organization_id=organization.id, id=rule_model.owner_team_id
                ).exists()
            if not is_member:
                rule_model.update(owner_user_id=None, owner_team_id=None)

        # [Rule, AlertRule(SnubaQuery->Environment)]
        # id -> name
        environment_names_with_alerts = {
            **environment_names,
            **{
                env_id: env_name
                for env_id, env_name in AlertRule.objects.fetch_for_project(self).values_list(
                    "snuba_query__environment__id", "snuba_query__environment__name"
                )
            },
        }

        # conditionally create a new environment associated to the new Org -> Project -> AlertRule -> SnubaQuery
        # this should take care of any potentially dead references from SnubaQuery -> Environment when deleting
        # the old org
        # alertrule ->  snuba_query -> environment_id
        for snuba_id, environment_id in AlertRule.objects.fetch_for_project(self).values_list(
            "snuba_query_id", "snuba_query__environment__id"
        ):
            SnubaQuery.objects.filter(id=snuba_id).update(
                environment_id=Environment.get_or_create(
                    self, name=environment_names_with_alerts.get(environment_id, None)
                ).id
            )

        AlertRule.objects.fetch_for_project(self).update(organization=organization)

        # Manually move over external issues to the new org
        linked_groups = GroupLink.objects.filter(project_id=self.id).values_list(
            "linked_id", flat=True
        )

        for external_issues in chunked(
            RangeQuerySetWrapper(
                ExternalIssue.objects.filter(organization_id=old_org_id, id__in=linked_groups),
                step=1000,
            ),
            1000,
        ):
            for ei in external_issues:
                ei.organization_id = organization.id
            ExternalIssue.objects.bulk_update(external_issues, ["organization_id"])

    def add_team(self, team):
        from sentry.models.projectteam import ProjectTeam

        try:
            with transaction.atomic(router.db_for_write(ProjectTeam)):
                ProjectTeam.objects.create(project=self, team=team)
        except IntegrityError:
            return False
        else:
            return True

    def remove_team(self, team):
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.models.projectteam import ProjectTeam
        from sentry.models.rule import Rule

        ProjectTeam.objects.filter(project=self, team=team).delete()
        AlertRule.objects.fetch_for_project(self).filter(team_id=team.id).update(team_id=None)
        Rule.objects.filter(owner_team_id=team.id, project=self).update(owner_team_id=None)

    def get_security_token(self):
        lock = locks.get(self.get_lock_key(), duration=5, name="project_security_token")
        with TimedRetryPolicy(10)(lock.acquire):
            security_token = self.get_option("sentry:token", None)
            if security_token is None:
                security_token = uuid1().hex
                self.update_option("sentry:token", security_token)
            return security_token

    def get_lock_key(self):
        return f"project_token:{self.id}"

    def copy_settings_from(self, project_id: int) -> bool:
        """
        Copies project level settings of the inputted project
        - General Settings
        - ProjectTeams
        - Alerts Settings and Rules
        - EnvironmentProjects
        - ProjectOwnership Rules and settings
        - Project Inbound Data Filters

        Returns True if the settings have successfully been copied over
        Returns False otherwise
        """
        from sentry.models.environment import EnvironmentProject
        from sentry.models.options.project_option import ProjectOption
        from sentry.models.projectownership import ProjectOwnership
        from sentry.models.projectteam import ProjectTeam
        from sentry.models.rule import Rule

        # XXX: this type sucks but it helps the type checker understand
        model_list: tuple[type[EnvironmentProject | ProjectOwnership | ProjectTeam | Rule], ...] = (
            EnvironmentProject,
            ProjectOwnership,
            ProjectTeam,
            Rule,
        )

        project = Project.objects.get(id=project_id)
        try:
            with transaction.atomic(router.db_for_write(Project)):
                for model in model_list:
                    # remove all previous project settings
                    model.objects.filter(project_id=self.id).delete()

                    # add settings from other project to self
                    for setting in model.objects.filter(project_id=project_id):
                        setting.pk = None
                        setting.project_id = self.id
                        setting.save()

                options = ProjectOption.objects.get_all_values(project=project)
                for key, value in options.items():
                    self.update_option(key, value)

        except IntegrityError as e:
            logging.exception(
                "Error occurred during copy project settings.",
                extra={
                    "error": str(e),
                    "project_to": self.id,
                    "project_from": project_id,
                },
            )
            return False
        return True

    @staticmethod
    def is_valid_platform(value):
        return not value or value == "other" or value in GETTING_STARTED_DOCS_PLATFORMS

    @staticmethod
    def outbox_for_update(project_identifier: int, organization_identifier: int) -> RegionOutbox:
        return RegionOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=organization_identifier,
            category=OutboxCategory.PROJECT_UPDATE,
            object_identifier=project_identifier,
        )

    def delete(self, *args, **kwargs):
        # There is no foreign key relationship so we have to manually cascade.
        notifications_service.remove_notification_settings_for_project(project_id=self.id)

        with outbox_context(transaction.atomic(router.db_for_write(Project))):
            Project.outbox_for_update(self.id, self.organization_id).save()
            return super().delete(*args, **kwargs)

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)

        # A `Global` restore implies a blanket restoration of all data. In such a case, we want to
        # ensure that project IDs remain unchanged, so that recovering users do not need to mint new
        # DSNs post-recovery.
        if scope == ImportScope.Global:
            self.pk = old_pk

        return old_pk


pre_delete.connect(delete_pending_deletion_option, sender=Project, weak=False)
