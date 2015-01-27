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
from sentry.db.models import BoundedPositiveIntegerField, Model, sane_repr
from sentry.db.models.utils import slugify_instance
from sentry.manager import TeamManager
from sentry.utils.http import absolute_uri


# TODO(dcramer): pull in enum library
class TeamStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class Team(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=64)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL)
    status = BoundedPositiveIntegerField(choices=(
        (TeamStatus.VISIBLE, _('Visible')),
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
