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
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)
from sentry.db.models.utils import slugify_instance


class TeamManager(BaseManager):
    def get_for_user(self, organization, user, access=None, with_projects=False):
        """
        Returns a list of all teams a user has some level of access to.

        Each <Team> returned has an ``access_type`` attribute which holds the
        OrganizationMemberType value.
        """
        from sentry.models import (
            OrganizationMember, OrganizationMemberTeam,
            OrganizationMemberType, Project
        )

        if not user.is_authenticated():
            return []

        base_team_qs = self.filter(
            organization=organization,
            status=TeamStatus.VISIBLE
        )

        if user.is_superuser or (settings.SENTRY_PUBLIC and access is None):
            inactive = list(OrganizationMemberTeam.objects.filter(
                organizationmember__user=user,
                organizationmember__organization=organization,
                is_active=False,
            ).values_list('team', flat=True))

            team_list = base_team_qs
            if inactive:
                team_list = team_list.exclude(id__in=inactive)

            team_list = list(team_list)

            if user.is_superuser:
                access = OrganizationMemberType.OWNER
            else:
                access = OrganizationMemberType.MEMBER
            for team in team_list:
                team.access_type = access

        else:
            om_qs = OrganizationMember.objects.filter(
                user=user,
                organization=organization,
            )
            if access is not None:
                om_qs = om_qs.filter(type__lte=access)

            try:
                om = om_qs.get()
            except OrganizationMember.DoesNotExist:
                team_qs = self.none()
            else:
                team_qs = om.get_teams()
                for team in team_qs:
                    team.access_type = om.type

            team_list = set(team_qs)

        results = sorted(team_list, key=lambda x: x.name.lower())

        if with_projects:
            # these kinds of queries make people sad :(
            for idx, team in enumerate(results):
                project_list = list(Project.objects.get_for_user(
                    team=team,
                    user=user,
                    _skip_team_check=True
                ))
                results[idx] = (team, project_list)

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

    __repr__ = sane_repr('slug', 'owner_id', 'name')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, organization=self.organization)
        super(Team, self).save(*args, **kwargs)

    def get_owner_name(self):
        if not self.owner:
            return None
        if self.owner.first_name:
            return self.owner.first_name
        if self.owner.email:
            return self.owner.email.split('@', 1)[0]
        return self.owner.username

    @property
    def member_set(self):
        from sentry.models import OrganizationMember
        return self.organization.member_set.filter(
            Q(organizationmemberteam__team=self) |
            Q(has_global_access=True),
            user__is_active=True,
        ).exclude(
            id__in=OrganizationMember.objects.filter(
                organizationmemberteam__is_active=False,
                organizationmemberteam__team=self,
            ).values('id')
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
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
        }
