from __future__ import absolute_import, print_function

import logging
import warnings
from collections import defaultdict

import six
from bitfield import BitField
from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models.signals import pre_delete
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.utils.http import urlencode
from uuid import uuid1

from sentry import projectoptions
from sentry.app import locks
from sentry.constants import ObjectStatus, RESERVED_PROJECT_SLUGS
from sentry.db.mixin import PendingDeletionMixin, delete_pending_deletion_option
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.integrationdocs import integration_doc_exists
from sentry.utils.colors import get_hashed_color
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy

# TODO(dcramer): pull in enum library
ProjectStatus = ObjectStatus


class ProjectTeam(Model):
    __core__ = True

    project = FlexibleForeignKey("sentry.Project")
    team = FlexibleForeignKey("sentry.Team")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectteam"
        unique_together = (("project", "team"),)


class ProjectManager(BaseManager):
    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, scope=None, _skip_team_check=False):
        from sentry.models import Team

        if not (user and user.is_authenticated()):
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

        base_qs = self.filter(teams=team, status=ProjectStatus.VISIBLE)

        project_list = []
        for project in base_qs:
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())


class Project(Model, PendingDeletionMixin):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """

    __core__ = True

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
            ("has_alert_filters", "This Project has filters"),
            ("has_releases", "This Project has sent release data"),
            ("has_issue_alerts_targeting", "This Project has issue alerts targeting"),
            ("has_transactions", "This Project has sent transactions"),
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

    def __unicode__(self):
        return u"%s (%s)" % (self.name, self.slug)

    def next_short_id(self):
        from sentry.models import Counter

        return Counter.increment(self)

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get("slug:project", duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(
                    self, self.name, organization=self.organization, reserved=RESERVED_PROJECT_SLUGS
                )
            super(Project, self).save(*args, **kwargs)
        else:
            super(Project, self).save(*args, **kwargs)
        self.update_rev_for_option()

    def get_absolute_url(self, params=None):
        url = u"/organizations/{}/issues/".format(self.organization.slug)
        params = {} if params is None else params
        params["project"] = self.id
        if params:
            url = url + "?" + urlencode(params)
        return absolute_uri(url)

    def is_internal_project(self):
        for value in (settings.SENTRY_FRONTEND_PROJECT, settings.SENTRY_PROJECT):
            if six.text_type(self.id) == six.text_type(value) or six.text_type(
                self.slug
            ) == six.text_type(value):
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
    def callsign(self):
        warnings.warn(
            "Project.callsign is deprecated. Use Group.get_short_id() instead.", DeprecationWarning
        )
        return self.slug.upper()

    @property
    def color(self):
        if self.forced_color is not None:
            return "#%s" % self.forced_color
        return get_hashed_color(self.callsign or self.slug)

    @property
    def member_set(self):
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

    def get_member_alert_settings(self, user_option):
        """
        Returns a list of users who have alert notifications explicitly
        enabled/disabled.
        :param user_option: alert option key, typically 'mail:alert'
        :return: A dictionary in format {<user_id>: <int_alert_value>}
        """
        from sentry.models import UserOption

        return {
            o.user_id: int(o.value)
            for o in UserOption.objects.filter(project=self, key=user_option)
        }

    def get_notification_recipients(self, user_option):
        from sentry.models import UserOption

        alert_settings = self.get_member_alert_settings(user_option)
        disabled = set(u for u, v in six.iteritems(alert_settings) if v == 0)

        member_set = set(self.member_set.exclude(user__in=disabled).values_list("user", flat=True))

        # determine members default settings
        members_to_check = set(u for u in member_set if u not in alert_settings)
        if members_to_check:
            disabled = set(
                (
                    uo.user_id
                    for uo in UserOption.objects.filter(
                        key="subscribe_by_default", user__in=members_to_check
                    )
                    if uo.value == "0"
                )
            )
            member_set = [x for x in member_set if x not in disabled]

        return member_set

    def get_mail_alert_subscribers(self):
        user_ids = self.get_notification_recipients("mail:alert")
        if not user_ids:
            return []
        from sentry.models import User

        return list(User.objects.filter(id__in=user_ids))

    def is_user_subscribed_to_mail_alerts(self, user):
        from sentry.models import UserOption

        is_enabled = UserOption.objects.get_value(user, "mail:alert", project=self)
        if is_enabled is None:
            is_enabled = UserOption.objects.get_value(user, "subscribe_by_default", "1") == "1"
        else:
            is_enabled = bool(is_enabled)
        return is_enabled

    def filter_to_subscribed_users(self, users):
        """
        Filters a list of users down to the users who are subscribed to email alerts. We
        check both the project level settings and global default settings.
        """
        from sentry.models import UserOption

        project_options = UserOption.objects.filter(
            user__in=users, project=self, key="mail:alert"
        ).values_list("user_id", "value")

        user_settings = {user_id: value for user_id, value in project_options}
        users_without_project_setting = [user for user in users if user.id not in user_settings]
        if users_without_project_setting:
            user_default_settings = {
                user_id: value
                for user_id, value in UserOption.objects.filter(
                    user__in=users_without_project_setting,
                    key="subscribe_by_default",
                    project__isnull=True,
                ).values_list("user_id", "value")
            }
            for user in users_without_project_setting:
                user_settings[user.id] = int(user_default_settings.get(user.id, "1"))

        return [user for user in users if bool(user_settings[user.id])]

    def transfer_to(self, team=None, organization=None):
        # NOTE: this will only work properly if the new team is in a different
        # org than the existing one, which is currently the only use case in
        # production
        # TODO(jess): refactor this to make it an org transfer only
        from sentry.models import (
            Environment,
            EnvironmentProject,
            ProjectTeam,
            ReleaseProject,
            ReleaseProjectEnvironment,
            Rule,
        )

        if organization is None:
            organization = team.organization

        old_org_id = self.organization_id
        org_changed = old_org_id != organization.id

        self.organization = organization

        try:
            with transaction.atomic():
                self.update(organization=organization)
        except IntegrityError:
            slugify_instance(self, self.name, organization=organization)
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

        # ensure this actually exists in case from team was null
        if team is not None:
            self.add_team(team)

    def add_team(self, team):
        try:
            with transaction.atomic():
                ProjectTeam.objects.create(project=self, team=team)
        except IntegrityError:
            return False
        else:
            return True

    def remove_team(self, team):
        ProjectTeam.objects.filter(project=self, team=team).delete()

    def get_security_token(self):
        lock = locks.get(self.get_lock_key(), duration=5)
        with TimedRetryPolicy(10)(lock.acquire):
            security_token = self.get_option("sentry:token", None)
            if security_token is None:
                security_token = uuid1().hex
                self.update_option("sentry:token", security_token)
            return security_token

    def get_lock_key(self):
        return "project_token:%s" % self.id

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
        from sentry.models import EnvironmentProject, ProjectOption, ProjectOwnership, Rule

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
                for key, value in six.iteritems(options):
                    self.update_option(key, value)

        except IntegrityError as e:
            logging.exception(
                "Error occurred during copy project settings.",
                extra={
                    "error": six.text_type(e),
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


pre_delete.connect(delete_pending_deletion_option, sender=Project, weak=False)
