"""
sentry.models.organization
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, Model, sane_repr
)


# TODO(dcramer): pull in enum library
class OrganizationStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class OrganizationManager(BaseManager):
    def get_for_user(self, user, access=None):
        """
        Returns a set of all organizations a user has access to.

        Each <Organization> returned has an ``member_type`` attribute which
        holds the OrganizationMemberType value.
        """
        from sentry.models import OrganizationMember

        results = []

        if not user.is_authenticated():
            return results

        qs = OrganizationMember.objects.filter(
            user=user,
        ).select_related('organization')
        if access is not None:
            qs = qs.filter(type__lte=access)

        for om in qs:
            org = om.organization
            org.member_type = om.type
            results.append(org)

        return results


class Organization(Model):
    """
    A team represents a group of individuals which maintain ownership of projects.
    """
    name = models.CharField(max_length=64)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL)
    status = BoundedPositiveIntegerField(choices=(
        (OrganizationStatus.VISIBLE, _('Visible')),
        (OrganizationStatus.PENDING_DELETION, _('Pending Deletion')),
        (OrganizationStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=OrganizationStatus.VISIBLE)
    date_added = models.DateTimeField(default=timezone.now)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through='sentry.OrganizationMember', related_name='org_memberships')

    objects = OrganizationManager(cache_fields=(
        'pk',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organization'

    __repr__ = sane_repr('owner_id', 'name')

    def __unicode__(self):
        return self.name
