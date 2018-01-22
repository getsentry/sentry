"""
sentry.models.project
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import warnings

import six
from bitfield import BitField
from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from uuid import uuid1

from sentry.app import locks
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.colors import get_hashed_color
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy

# TODO(dcramer): pull in enum library
ProjectStatus = ObjectStatus


class ProjectTeam(Model):
    __core__ = True

    # TODO(jess): this unique index is temporary and should be
    # removed when the UI is updated to handle multiple teams
    # per project. This is just to prevent wonky behavior in
    # the mean time.
    project = FlexibleForeignKey('sentry.Project')
    team = FlexibleForeignKey('sentry.Team')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectteam'
        unique_together = (('project', 'team'), )


class ProjectManager(BaseManager):
    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, scope=None, _skip_team_check=False):
        from sentry.models import Team

        if not (user and user.is_authenticated()):
            return []

        if not _skip_team_check:
            team_list = Team.objects.get_for_user(
                organization=team.organization,
                user=user,
                scope=scope,
            )

            try:
                team = team_list[team_list.index(team)]
            except ValueError:
                logging.info('User does not have access to team: %s', team.id)
                return []

        base_qs = self.filter(
            teams=team,
            status=ProjectStatus.VISIBLE,
        )

        project_list = []
        for project in base_qs:
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())


class Project(Model):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """
    __core__ = True

    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)
    forced_color = models.CharField(max_length=6, null=True, blank=True)
    organization = FlexibleForeignKey('sentry.Organization')
    # DEPRECATED. use teams instead.
    team = FlexibleForeignKey('sentry.Team', null=True)
    teams = models.ManyToManyField(
        'sentry.Team', related_name='teams', through=ProjectTeam
    )
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ObjectStatus.VISIBLE,
             _('Active')), (ObjectStatus.PENDING_DELETION, _('Pending Deletion')),
            (ObjectStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
        ),
        db_index=True
    )
    # projects that were created before this field was present
    # will have their first_event field set to date_added
    first_event = models.DateTimeField(null=True)
    flags = BitField(
        flags=(('has_releases', 'This Project has sent release data'), ), default=0, null=True
    )

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])
    platform = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_project'
        unique_together = (('team', 'slug'), ('organization', 'slug'))

    __repr__ = sane_repr('team_id', 'name', 'slug')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def next_short_id(self):
        from sentry.models import Counter
        return Counter.increment(self)

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get('slug:project', duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name, organization=self.organization)
            super(Project, self).save(*args, **kwargs)
        else:
            super(Project, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return absolute_uri('/{}/{}/'.format(self.organization.slug, self.slug))

    def is_internal_project(self):
        for value in (settings.SENTRY_FRONTEND_PROJECT, settings.SENTRY_PROJECT):
            if six.text_type(self.id) == six.text_type(value) or six.text_type(
                self.slug
            ) == six.text_type(value):
                return True
        return False

    # TODO: Make these a mixin
    def update_option(self, *args, **kwargs):
        from sentry.models import ProjectOption

        return ProjectOption.objects.set_value(self, *args, **kwargs)

    def get_option(self, *args, **kwargs):
        from sentry.models import ProjectOption

        return ProjectOption.objects.get_value(self, *args, **kwargs)

    def delete_option(self, *args, **kwargs):
        from sentry.models import ProjectOption

        return ProjectOption.objects.unset_value(self, *args, **kwargs)

    @property
    def callsign(self):
        return self.slug.upper()

    @property
    def color(self):
        if self.forced_color is not None:
            return '#%s' % self.forced_color
        return get_hashed_color(self.callsign or self.slug)

    @property
    def member_set(self):
        from sentry.models import OrganizationMember
        return self.organization.member_set.filter(
            id__in=OrganizationMember.objects.filter(
                organizationmemberteam__is_active=True,
                organizationmemberteam__team=self.team,
            ).values('id'),
            user__is_active=True,
        ).distinct()

    def has_access(self, user, access=None):
        from sentry.models import AuthIdentity, OrganizationMember

        warnings.warn('Project.has_access is deprecated.', DeprecationWarning)

        queryset = self.member_set.filter(user=user)

        if access is not None:
            queryset = queryset.filter(type__lte=access)

        try:
            member = queryset.get()
        except OrganizationMember.DoesNotExist:
            return False

        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider__organization=self.organization_id,
                user=member.user_id,
            )
        except AuthIdentity.DoesNotExist:
            return True

        return auth_identity.is_valid(member)

    def get_audit_log_data(self):
        return {
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
            'public': self.public,
        }

    def get_full_name(self):
        if self.team.name not in self.name:
            return '%s %s' % (self.team.name, self.name)
        return self.name

    def get_notification_recipients(self, user_option):
        from sentry.models import UserOption
        alert_settings = dict(
            (o.user_id, int(o.value))
            for o in UserOption.objects.filter(
                project=self,
                key=user_option,
            )
        )

        disabled = set(u for u, v in six.iteritems(alert_settings) if v == 0)

        member_set = set(
            self.member_set.exclude(
                user__in=disabled,
            ).values_list('user', flat=True)
        )

        # determine members default settings
        members_to_check = set(u for u in member_set if u not in alert_settings)
        if members_to_check:
            disabled = set(
                (
                    uo.user_id
                    for uo in UserOption.objects.filter(
                        key='subscribe_by_default',
                        user__in=members_to_check,
                    ) if uo.value == '0'
                )
            )
            member_set = [x for x in member_set if x not in disabled]

        return member_set

    def get_mail_alert_subscribers(self):
        user_ids = self.get_notification_recipients('mail:alert')
        if not user_ids:
            return []
        from sentry.models import User
        return list(User.objects.filter(id__in=user_ids))

    def is_user_subscribed_to_mail_alerts(self, user):
        from sentry.models import UserOption
        is_enabled = UserOption.objects.get_value(user, 'mail:alert', project=self)
        if is_enabled is None:
            is_enabled = UserOption.objects.get_value(user, 'subscribe_by_default', '1') == '1'
        else:
            is_enabled = bool(is_enabled)
        return is_enabled

    def transfer_to(self, team):
        from sentry.models import ProjectTeam, ReleaseProject

        organization = team.organization
        from_team_id = self.team_id

        # We only need to delete ReleaseProjects when moving to a different
        # Organization. Releases are bound to Organization, so it's not realistic
        # to keep this link unless we say, copied all Releases as well.
        if self.organization_id != organization.id:
            ReleaseProject.objects.filter(
                project_id=self.id,
            ).delete()

        self.organization = organization
        self.team = team

        try:
            with transaction.atomic():
                self.update(
                    organization=organization,
                    team=team,
                )
        except IntegrityError:
            slugify_instance(self, self.name, organization=organization)
            self.update(
                slug=self.slug,
                organization=organization,
                team=team,
            )

        ProjectTeam.objects.filter(project=self, team_id=from_team_id).update(team=team)

    def add_team(self, team):
        try:
            with transaction.atomic():
                ProjectTeam.objects.create(project=self, team=team)
        except IntegrityError:
            return False
        else:
            return True

    def get_security_token(self):
        lock = locks.get(self.get_lock_key(), duration=5)
        with TimedRetryPolicy(10)(lock.acquire):
            security_token = self.get_option('sentry:token', None)
            if security_token is None:
                security_token = uuid1().hex
                self.update_option('sentry:token', security_token)
            return security_token

    def get_lock_key(self):
        return 'project_token:%s' % self.id
