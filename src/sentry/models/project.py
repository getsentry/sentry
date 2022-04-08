from __future__ import annotations

import logging
import warnings
from collections import defaultdict
from itertools import chain
from typing import TYPE_CHECKING, Iterable, Mapping, Sequence
from uuid import uuid1

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import QuerySet
from django.db.models.signals import pre_delete
from django.utils import timezone
from django.utils.http import urlencode
from django.utils.translation import ugettext_lazy as _

from bitfield import BitField
from sentry import projectoptions
from sentry.app import locks
from sentry.constants import RESERVED_PROJECT_SLUGS, ObjectStatus
from sentry.db.mixin import PendingDeletionMixin, delete_pending_deletion_option
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.snuba.models import SnubaQuery
from sentry.utils import metrics
from sentry.utils.colors import get_hashed_color
from sentry.utils.http import absolute_uri
from sentry.utils.integrationdocs import integration_doc_exists
from sentry.utils.retries import TimedRetryPolicy

if TYPE_CHECKING:
    from sentry.models import User

# TODO(dcramer): pull in enum library
ProjectStatus = ObjectStatus


class ProjectManager(BaseManager):
    def get_by_users(self, users: Iterable[User]) -> Mapping[int, Iterable[int]]:
        """Given a list of users, return a mapping of each user to the projects they are a member of."""
        project_rows = self.filter(
            projectteam__team__organizationmemberteam__is_active=True,
            projectteam__team__organizationmemberteam__organizationmember__user__in=users,
        ).values_list("id", "projectteam__team__organizationmemberteam__organizationmember__user")

        projects_by_user_id = defaultdict(set)
        for project_id, user_id in project_rows:
            projects_by_user_id[user_id].add(project_id)
        return projects_by_user_id

    def get_for_user_ids(self, user_ids: Sequence[int]) -> QuerySet:
        """Returns the QuerySet of all projects that a set of Users have access to."""
        from sentry.models import ProjectStatus

        return self.filter(
            status=ProjectStatus.VISIBLE,
            teams__organizationmember__user_id__in=user_ids,
        )

    def get_for_team_ids(self, team_ids: Sequence[int]) -> QuerySet:
        """Returns the QuerySet of all projects that a set of Teams have access to."""
        from sentry.models import ProjectStatus

        return self.filter(status=ProjectStatus.VISIBLE, teams__in=team_ids)

    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, scope=None, _skip_team_check=False):
        from sentry.models import Team

        if not (user and user.is_authenticated):
            return []

        if not _skip_team_check:
            team_list = Team.objects.get_for_user(
                organization=team.organization, user=user, scope=scope
            )

            try:
                team = team_list[team_list.index(team)]
            except ValueError:
                logging.info(f"User does not have access to team: {team.id}")
                return []

        base_qs = self.filter(teams=team, status=ProjectStatus.VISIBLE)

        project_list = []
        for project in base_qs:
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())


class Project(Model, PendingDeletionMixin):
    from sentry.models.projectteam import ProjectTeam

    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """

    __include_in_export__ = True

    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)
    forced_color = models.CharField(max_length=6, null=True, blank=True)
    organization = FlexibleForeignKey("sentry.Organization")
    teams = models.ManyToManyField("sentry.Team", related_name="teams", through=ProjectTeam)
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ObjectStatus.VISIBLE, _("Active")),
            (ObjectStatus.PENDING_DELETION, _("Pending Deletion")),
            (ObjectStatus.DELETION_IN_PROGRESS, _("Deletion in Progress")),
        ),
        db_index=True,
    )
    # projects that were created before this field was present
    # will have their first_event field set to date_added
    first_event = models.DateTimeField(null=True)
    flags = BitField(
        flags=(
            ("has_releases", "This Project has sent release data"),
            ("has_issue_alerts_targeting", "This Project has issue alerts targeting"),
            ("has_transactions", "This Project has sent transactions"),
            ("has_alert_filters", "This Project has filters"),
            ("has_sessions", "This Project has sessions"),
        ),
        default=10,
        null=True,
    )

    objects = ProjectManager(cache_fields=["pk"])
    platform = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_project"
        unique_together = (("organization", "slug"),)

    __repr__ = sane_repr("team_id", "name", "slug")

    _rename_fields_on_pending_delete = frozenset(["slug"])

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def next_short_id(self):
        from sentry.models import Counter

        with sentry_sdk.start_span(op="project.next_short_id") as span, metrics.timer(
            "project.next_short_id"
        ):
            span.set_data("project_id", self.id)
            span.set_data("project_slug", self.slug)
            return Counter.increment(self)

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get("slug:project", duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(
                    self,
                    self.name,
                    organization=self.organization,
                    reserved=RESERVED_PROJECT_SLUGS,
                    max_length=50,
                )
            super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)
        self.update_rev_for_option()

    def get_absolute_url(self, params=None):
        url = f"/organizations/{self.organization.slug}/issues/"
        params = {} if params is None else params
        params["project"] = self.id
        if params:
            url = url + "?" + urlencode(params)
        return absolute_uri(url)

    def is_internal_project(self):
        for value in (settings.SENTRY_FRONTEND_PROJECT, settings.SENTRY_PROJECT):
            if str(self.id) == str(value) or str(self.slug) == str(value):
                return True
        return False

    # TODO: Make these a mixin
    def update_option(self, *args, **kwargs):
        return projectoptions.set(self, *args, **kwargs)

    def get_option(self, *args, **kwargs):
        return projectoptions.get(self, *args, **kwargs)

    def delete_option(self, *args, **kwargs):
        return projectoptions.delete(self, *args, **kwargs)

    def update_rev_for_option(self):
        return projectoptions.update_rev_for_option(self)

    @property
    def color(self):
        if self.forced_color is not None:
            return f"#{self.forced_color}"
        return get_hashed_color(self.slug.upper())

    @property
    def member_set(self):
        """:returns a QuerySet of all Users that belong to this Project"""
        from sentry.models import OrganizationMember

        return self.organization.member_set.filter(
            id__in=OrganizationMember.objects.filter(
                organizationmemberteam__is_active=True,
                organizationmemberteam__team__in=self.teams.all(),
            ).values("id"),
            user__is_active=True,
        ).distinct()

    def has_access(self, user, access=None):
        from sentry.models import AuthIdentity, OrganizationMember

        warnings.warn("Project.has_access is deprecated.", DeprecationWarning)

        queryset = self.member_set.filter(user=user)

        if access is not None:
            queryset = queryset.filter(type__lte=access)

        try:
            member = queryset.get()
        except OrganizationMember.DoesNotExist:
            return False

        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider__organization=self.organization_id, user=member.user_id
            )
        except AuthIdentity.DoesNotExist:
            return True

        return auth_identity.is_valid(member)

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
        from sentry.incidents.models import AlertRule
        from sentry.models import (
            Environment,
            EnvironmentProject,
            ProjectTeam,
            ReleaseProject,
            ReleaseProjectEnvironment,
            Rule,
        )
        from sentry.models.actor import ACTOR_TYPES

        old_org_id = self.organization_id
        org_changed = old_org_id != organization.id

        self.organization = organization

        try:
            with transaction.atomic():
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
            rules_by_environment_id[environment_id].add(rule_id)

        environment_names = dict(
            Environment.objects.filter(id__in=rules_by_environment_id).values_list("id", "name")
        )

        for environment_id, rule_ids in rules_by_environment_id.items():
            Rule.objects.filter(id__in=rule_ids).update(
                environment_id=Environment.get_or_create(self, environment_names[environment_id]).id
            )

        # Remove alert owners not in new org
        alert_rules = AlertRule.objects.fetch_for_project(self).filter(owner_id__isnull=False)
        rules = Rule.objects.filter(owner_id__isnull=False, project=self)
        for rule in list(chain(alert_rules, rules)):
            actor = rule.owner
            if actor.type == ACTOR_TYPES["user"]:
                is_member = organization.member_set.filter(user=actor.resolve()).exists()
            if actor.type == ACTOR_TYPES["team"]:
                is_member = actor.resolve().organization_id == organization.id
            if not is_member:
                rule.update(owner=None)

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

    def add_team(self, team):
        from sentry.models.projectteam import ProjectTeam

        try:
            with transaction.atomic():
                ProjectTeam.objects.create(project=self, team=team)
        except IntegrityError:
            return False
        else:
            return True

    def remove_team(self, team):
        from sentry.incidents.models import AlertRule
        from sentry.models import Rule
        from sentry.models.projectteam import ProjectTeam

        ProjectTeam.objects.filter(project=self, team=team).delete()
        AlertRule.objects.fetch_for_project(self).filter(owner_id=team.actor_id).update(owner=None)
        Rule.objects.filter(owner_id=team.actor_id, project=self).update(owner=None)

    def get_security_token(self):
        lock = locks.get(self.get_lock_key(), duration=5)
        with TimedRetryPolicy(10)(lock.acquire):
            security_token = self.get_option("sentry:token", None)
            if security_token is None:
                security_token = uuid1().hex
                self.update_option("sentry:token", security_token)
            return security_token

    def get_lock_key(self):
        return f"project_token:{self.id}"

    def copy_settings_from(self, project_id):
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
        from sentry.models import (
            EnvironmentProject,
            ProjectOption,
            ProjectOwnership,
            ProjectTeam,
            Rule,
        )

        model_list = [EnvironmentProject, ProjectOwnership, ProjectTeam, Rule]

        project = Project.objects.get(id=project_id)
        try:
            with transaction.atomic():
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
        if not value or value == "other":
            return True
        return integration_doc_exists(value)

    def delete(self, **kwargs):
        from sentry.models import NotificationSetting

        # There is no foreign key relationship so we have to manually cascade.
        NotificationSetting.objects.remove_for_project(self)

        return super().delete(**kwargs)


pre_delete.connect(delete_pending_deletion_option, sender=Project, weak=False)
