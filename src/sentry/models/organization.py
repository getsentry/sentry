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

from sentry.constants import RESERVED_ORGANIZATION_SLUGS
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)
from sentry.db.models.utils import slugify_instance


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
        from sentry.models import OrganizationMember, OrganizationMemberType

        results = []

        if not user.is_authenticated():
            return results

        if settings.SENTRY_PUBLIC and access is None:
            qs = self.filter(status=OrganizationStatus.VISIBLE)
            for org in qs:
                org.member_type = OrganizationMemberType.MEMBER
                results.append(org)

        else:
            qs = OrganizationMember.objects.filter(
                user=user,
                organization__status=OrganizationStatus.VISIBLE,
            ).select_related('organization')
            if access is not None:
                # if we're requesting specific access the member *must* have
                # global access to teams
                qs = qs.filter(
                    type__lte=access,
                    has_global_access=True,
                )

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
    slug = models.SlugField(unique=True)
    owner = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    status = BoundedPositiveIntegerField(choices=(
        (OrganizationStatus.VISIBLE, _('Visible')),
        (OrganizationStatus.PENDING_DELETION, _('Pending Deletion')),
        (OrganizationStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=OrganizationStatus.VISIBLE)
    date_added = models.DateTimeField(default=timezone.now)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through='sentry.OrganizationMember', related_name='org_memberships')

    objects = OrganizationManager(cache_fields=(
        'pk',
        'slug',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organization'

    __repr__ = sane_repr('owner_id', 'name')

    def __unicode__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, reserved=RESERVED_ORGANIZATION_SLUGS)
        super(Organization, self).save(*args, **kwargs)

    def get_audit_log_data(self):
        return {
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
        }
