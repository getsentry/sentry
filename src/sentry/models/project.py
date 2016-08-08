"""
sentry.models.project
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import six
import warnings

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.app import locks
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.colors import get_hashed_color
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy


# TODO(dcramer): pull in enum library
class ProjectStatus(object):
    VISIBLE = 0
    HIDDEN = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3


class ProjectManager(BaseManager):
    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, _skip_team_check=False):
        from sentry.models import Team

        if not (user and user.is_authenticated()):
            return []

        if not _skip_team_check:
            team_list = Team.objects.get_for_user(
                organization=team.organization,
                user=user,
            )

            try:
                team = team_list[team_list.index(team)]
            except ValueError:
                logging.info('User does not have access to team: %s', team.id)
                return []

        base_qs = self.filter(
            team=team,
            status=ProjectStatus.VISIBLE,
        )

        project_list = []
        for project in base_qs:
            project.team = team
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
    team = FlexibleForeignKey('sentry.Team')
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(default=0, choices=(
        (ProjectStatus.VISIBLE, _('Active')),
        (ProjectStatus.PENDING_DELETION, _('Pending Deletion')),
        (ProjectStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), db_index=True)
    # projects that were created before this field was present
    # will have their first_event field set to date_added
    first_event = models.DateTimeField(null=True)

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])

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
        return absolute_uri(reverse('sentry-stream', args=[
            self.organization.slug, self.slug]))

    def merge_to(self, project):
        from sentry.models import (
            Group, GroupTagValue, Event, TagValue
        )

        if not isinstance(project, Project):
            project = Project.objects.get_from_cache(pk=project)

        for group in Group.objects.filter(project=self):
            try:
                other = Group.objects.get(
                    project=project,
                )
            except Group.DoesNotExist:
                group.update(project=project)
                GroupTagValue.objects.filter(
                    project=self,
                    group_id=group,
                ).update(project=project)
            else:
                Event.objects.filter(
                    group_id=group.id,
                ).update(group_id=other.id)

                for obj in GroupTagValue.objects.filter(group=group):
                    obj2, created = GroupTagValue.objects.get_or_create(
                        project=project,
                        group=group,
                        key=obj.key,
                        value=obj.value,
                        defaults={'times_seen': obj.times_seen}
                    )
                    if not created:
                        obj2.update(times_seen=F('times_seen') + obj.times_seen)

        for fv in TagValue.objects.filter(project=self):
            TagValue.objects.get_or_create(project=project, key=fv.key, value=fv.value)
            fv.delete()
        self.delete()

    def is_internal_project(self):
        for value in (settings.SENTRY_FRONTEND_PROJECT, settings.SENTRY_PROJECT):
            if six.text_type(self.id) == six.text_type(value) or six.text_type(self.slug) == six.text_type(value):
                return True
        return False

    def get_tags(self, with_internal=True):
        from sentry.models import TagKey

        if not hasattr(self, '_tag_cache'):
            tags = self.get_option('tags', None)
            if tags is None:
                tags = [
                    t for t in TagKey.objects.all_keys(self)
                    if with_internal or not t.startswith('sentry:')
                ]
            self._tag_cache = tags
        return self._tag_cache

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

    def is_user_subscribed_to_mail_alerts(self, user):
        from sentry.models import UserOption
        is_enabled = UserOption.objects.get_value(
            user, self, 'mail:alert', None)
        if is_enabled is None:
            is_enabled = UserOption.objects.get_value(
                user, None, 'subscribe_by_default', '1') == '1'
        else:
            is_enabled = bool(is_enabled)
        return is_enabled

    def is_user_subscribed_to_workflow(self, user):
        from sentry.models import UserOption, UserOptionValue

        opt_value = UserOption.objects.get_value(
            user, self, 'workflow:notifications', None)
        if opt_value is None:
            opt_value = UserOption.objects.get_value(
                user, None, 'workflow:notifications',
                UserOptionValue.all_conversations)
        return opt_value == UserOptionValue.all_conversations
