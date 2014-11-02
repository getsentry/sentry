"""
sentry.models.team
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.constants import RESERVED_TEAM_SLUGS
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, Model, sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.http import absolute_uri


class TeamManager(BaseManager):
    def get_for_user(self, organization, user, access=None, access_groups=True,
                     with_projects=False):
        """
        Returns a SortedDict of all teams a user has some level of access to.

        Each <Team> returned has an ``access_type`` attribute which holds the
        MEMBER_TYPE value.
        """
        from sentry.models import (
            OrganizationMember, Project
        )

        if not user.is_authenticated():
            return []

        all_teams = set()

        qs = OrganizationMember.objects.filter(
            user=user,
            organization=organization,
        )
        if access is not None:
            qs = qs.filter(type__lte=access)

        try:
            om = qs.get()
        except OrganizationMember.DoesNotExist:
            return []

        if om.has_global_access:
            team_qs = self.filter(organization=organization)
        else:
            team_qs = om.teams.all()

        for team in team_qs:
            team.access_type = om.type
            all_teams.add(team)

        results = sorted(all_teams, key=lambda x: x.name.lower())

        if with_projects:
            # these kinds of queries make people sad :(
            for idx, team in enumerate(results):
                project_list = list(Project.objects.get_for_user(
                    team=team,
                    user=user,
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
    organization = models.ForeignKey('sentry.Organization')
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=64)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL)
    status = BoundedPositiveIntegerField(choices=(
        (TeamStatus.VISIBLE, _('Active')),
        (TeamStatus.PENDING_DELETION, _('Pending Deletion')),
        (TeamStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=TeamStatus.VISIBLE)
    date_added = models.DateTimeField(default=timezone.now, null=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through='sentry.TeamMember', related_name='team_memberships')

    objects = TeamManager(cache_fields=(
        'pk',
        'slug',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_team'

    __repr__ = sane_repr('slug', 'owner_id', 'name')

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, reserved=RESERVED_TEAM_SLUGS)
        super(Team, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry', args=[
            self.slug]))

    def get_owner_name(self):
        if not self.owner:
            return None
        if self.owner.first_name:
            return self.owner.first_name
        if self.owner.email:
            return self.owner.email.split('@', 1)[0]
        return self.owner.username
