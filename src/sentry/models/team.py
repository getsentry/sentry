"""
sentry.models.team
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import warnings

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.app import env
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.cache import Lock


class TeamManager(BaseManager):
    def get_for_user(self, organization, user, with_projects=False):
        """
        Returns a list of all teams a user has some level of access to.
        """
        from sentry.models import (
            OrganizationMemberTeam, Project, ProjectStatus
        )

        if not user.is_authenticated():
            return []

        base_team_qs = self.filter(
            organization=organization,
            status=TeamStatus.VISIBLE
        )

        if env.request and env.request.is_superuser() or settings.SENTRY_PUBLIC:
            team_list = list(base_team_qs)

        else:
            team_list = list(base_team_qs.filter(
                id__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__user=user,
                    organizationmember__organization=organization,
                    is_active=True,
                ).values_list('team'),
            ))

        results = sorted(team_list, key=lambda x: x.name.lower())

        if with_projects:
            project_list = sorted(Project.objects.filter(
                team__in=team_list,
                status=ProjectStatus.VISIBLE,
            ), key=lambda x: x.name.lower())
            projects_by_team = {
                t.id: [] for t in team_list
            }
            for project in project_list:
                projects_by_team[project.team_id].append(project)

            # these kinds of queries make people sad :(
            for idx, team in enumerate(results):
                team_projects = projects_by_team[team.id]
                for project in team_projects:
                    project.team = team
                results[idx] = (team, team_projects)

        return results


# TODO(dcramer): pull in enum library
class TeamStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class Team(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """
    organization = FlexibleForeignKey('sentry.Organization')
    slug = models.SlugField()
    name = models.CharField(max_length=64)
    status = BoundedPositiveIntegerField(choices=(
        (TeamStatus.VISIBLE, _('Active')),
        (TeamStatus.PENDING_DELETION, _('Pending Deletion')),
        (TeamStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=TeamStatus.VISIBLE)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = TeamManager(cache_fields=(
        'pk',
        'slug',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_team'
        unique_together = (('organization', 'slug'),)

    __repr__ = sane_repr('slug', 'name')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            lock_key = 'slug:team'
            with Lock(lock_key):
                slugify_instance(self, self.name, organization=self.organization)
            super(Team, self).save(*args, **kwargs)
        else:
            super(Team, self).save(*args, **kwargs)

    @property
    def member_set(self):
        return self.organization.member_set.filter(
            organizationmemberteam__team=self,
            organizationmemberteam__is_active=True,
            user__is_active=True,
        ).distinct()

    def has_access(self, user, access=None):
        from sentry.models import AuthIdentity, OrganizationMember

        warnings.warn('Team.has_access is deprecated.', DeprecationWarning)

        queryset = self.member_set.filter(
            user=user,
        )
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
        }
