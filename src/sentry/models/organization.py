"""
sentry.models.organization
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from bitfield import BitField
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property
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
    # def get_by_natural_key(self, slug):
    #     return self.get(slug=slug)

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
    An organization represents a group of individuals which maintain ownership of projects.
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

    flags = BitField(flags=(
        ('allow_joinleave', 'Allow members to join and leave teams without requiring approval.'),
    ), default=0)

    objects = OrganizationManager(cache_fields=(
        'pk',
        'slug',
    ))

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organization'

    __repr__ = sane_repr('owner_id', 'name', 'slug')

    @classmethod
    def get_default(cls):
        """
        Return the organization used in single organization mode.
        """
        return cls.objects.filter(
            status=OrganizationStatus.VISIBLE,
        )[0]

    def __unicode__(self):
        return u'%s (%s)' % (self.name, self.slug)

    def save(self, *args, **kwargs):
        if not self.slug:
            slugify_instance(self, self.name, reserved=RESERVED_ORGANIZATION_SLUGS)
        super(Organization, self).save(*args, **kwargs)

    def delete(self):
        if self.is_default:
            raise Exception('You cannot delete the the default organization.')
        return super(Organization, self).delete()

    @cached_property
    def is_default(self):
        if not settings.SENTRY_SINGLE_ORGANIZATION:
            return False

        return self == type(self).get_default()

    def has_access(self, user, access=None):
        queryset = self.member_set.filter(user=user)
        if access is not None:
            queryset = queryset.filter(type__lte=access)

        return queryset.exists()

    def get_audit_log_data(self):
        return {
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
            'flags': self.flags,
        }

    def merge_to(from_org, to_org):
        from sentry.models import (
            ApiKey, AuditLogEntry, OrganizationMember, OrganizationMemberTeam,
            Project, Team
        )

        team_list = list(Team.objects.filter(
            organization=to_org,
        ))

        for from_member in OrganizationMember.objects.filter(organization=from_org):
            try:
                to_member = OrganizationMember.objects.get(
                    organization=to_org,
                    user=from_member.user,
                )
            except OrganizationMember.DoesNotExist:
                from_member.update(organization=to_org)
                to_member = from_member

            if to_member.has_global_access:
                for team in team_list:
                    OrganizationMemberTeam.objects.get_or_create(
                        organizationmember=to_member,
                        team=team,
                        defaults={
                            'is_active': False,
                        },
                    )

        for model in (Team, Project, ApiKey, AuditLogEntry):
            model.objects.filter(
                organization=from_org,
            ).update(organization=to_org)
