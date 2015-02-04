"""
sentry.models.project
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.constants import PLATFORM_TITLES, PLATFORM_LIST
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.http import absolute_uri


class ProjectManager(BaseManager):
    # TODO(dcramer): we might want to cache this per user
    def get_for_user(self, team, user, access=None, _skip_team_check=False):
        from sentry.models import Team

        if not (user and user.is_authenticated()):
            return []

        if not _skip_team_check:
            team_list = Team.objects.get_for_user(
                organization=team.organization,
                user=user,
                access=access,
            )

            try:
                team = team_list[team_list.index(team)]
            except ValueError:
                logging.info('User does not have access to team: %s', team.id)
                return []

        # Identify access groups
        if getattr(team, 'is_access_group', False):
            logging.warning('Team is using deprecated access groups: %s', team.id)
            base_qs = Project.objects.filter(
                accessgroup__team=team,
                accessgroup__members=user,
                status=ProjectStatus.VISIBLE,
            )
        else:
            base_qs = self.filter(
                team=team,
                status=ProjectStatus.VISIBLE,
            )

        project_list = []
        for project in base_qs:
            project.team = team
            project_list.append(project)

        return sorted(project_list, key=lambda x: x.name.lower())


# TODO(dcramer): pull in enum library
class ProjectStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class Project(Model):
    """
    Projects are permission based namespaces which generally
    are the top level entry point for all data.
    """
    PLATFORM_CHOICES = tuple(
        (p, PLATFORM_TITLES.get(p, p.title()))
        for p in PLATFORM_LIST
    ) + (('other', 'Other'),)

    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey('sentry.Organization')
    team = FlexibleForeignKey('sentry.Team')
    public = models.BooleanField(default=False)
    date_added = models.DateTimeField(default=timezone.now)
    status = BoundedPositiveIntegerField(default=0, choices=(
        (ProjectStatus.VISIBLE, _('Active')),
        (ProjectStatus.PENDING_DELETION, _('Pending Deletion')),
        (ProjectStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), db_index=True)
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES, null=True)

    objects = ProjectManager(cache_fields=[
        'pk',
        'slug',
    ])

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_project'
        unique_together = (('team', 'slug'), ('organization', 'slug'))

    __repr__ = sane_repr('team_id', 'slug')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, organization=self.organization)
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
                    checksum=group.checksum,
                )
            except Group.DoesNotExist:
                group.update(project=project)
                for model in (Event, GroupTagValue):
                    model.objects.filter(project=self, group=group).update(project=project)
            else:
                Event.objects.filter(group=group).update(group=other)

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
            if str(self.id) == str(value) or str(self.slug) == str(value):
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

    def has_access(self, user, access=None):
        from sentry.models import OrganizationMember

        queryset = OrganizationMember.objects.filter(
            Q(teams=self.team) | Q(has_global_access=True),
            user__is_active=True,
            user=user,
            organization=self.organization,
        )
        if access is not None:
            queryset = queryset.filter(type__lte=access)

        return queryset.exists()

    def get_audit_log_data(self):
        return {
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
            'public': self.public,
            'platform': self.platform,
        }
