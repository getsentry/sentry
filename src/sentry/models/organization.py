"""
sentry.models.organization
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from datetime import timedelta

from bitfield import BitField
from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import ugettext_lazy as _

from sentry import roles
from sentry.app import locks
from sentry.constants import RESERVED_ORGANIZATION_SLUGS
from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, Model, sane_repr
)
from sentry.db.models.utils import slugify_instance
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy


# TODO(dcramer): pull in enum library
class OrganizationStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class OrganizationManager(BaseManager):
    # def get_by_natural_key(self, slug):
    #     return self.get(slug=slug)

    def get_for_user(self, user, scope=None, only_visible=True):
        """
        Returns a set of all organizations a user has access to.
        """
        from sentry.models import OrganizationMember

        if not user.is_authenticated():
            return []

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(self.filter(status=OrganizationStatus.VISIBLE))
            else:
                return list(self.filter())

        qs = OrganizationMember.objects.filter(user=user).select_related('organization')
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.VISIBLE)

        results = list(qs)

        if scope is not None:
            return [
                r.organization for r in results
                if scope in r.get_scopes()
            ]
        return [r.organization for r in results]


class Organization(Model):
    """
    An organization represents a group of individuals which maintain ownership of projects.
    """
    __core__ = True

    name = models.CharField(max_length=64)
    slug = models.SlugField(unique=True)
    status = BoundedPositiveIntegerField(choices=(
        (OrganizationStatus.VISIBLE, _('Visible')),
        (OrganizationStatus.PENDING_DELETION, _('Pending Deletion')),
        (OrganizationStatus.DELETION_IN_PROGRESS, _('Deletion in Progress')),
    ), default=OrganizationStatus.VISIBLE)
    date_added = models.DateTimeField(default=timezone.now)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through='sentry.OrganizationMember', related_name='org_memberships')
    default_role = models.CharField(
        choices=roles.get_choices(),
        max_length=32,
        default=roles.get_default().id,
    )

    flags = BitField(flags=(
        ('allow_joinleave', 'Allow members to join and leave teams without requiring approval.'),
        ('enhanced_privacy', 'Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.'),
        ('disable_shared_issues', 'Disable sharing of limited details on issues to anonymous users.'),
        ('early_adopter', 'Enable early adopter status, gaining access to features prior to public release.'),
    ), default=1)

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
            lock = locks.get('slug:organization', duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name,
                                 reserved=RESERVED_ORGANIZATION_SLUGS)
            super(Organization, self).save(*args, **kwargs)
        else:
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
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'status': self.status,
            'flags': self.flags,
            'default_role': self.default_role,
        }

    def get_owners(self):
        from sentry.models import User
        return User.objects.filter(
            sentry_orgmember_set__role=roles.get_top_dog().id,
            sentry_orgmember_set__organization=self,
            is_active=True,
        )

    def get_default_owner(self):
        if not hasattr(self, '_default_owner'):
            self._default_owner = self.get_owners()[0]
        return self._default_owner

    def has_single_owner(self):
        from sentry.models import OrganizationMember
        count = OrganizationMember.objects.filter(
            organization=self,
            role=roles.get_top_dog().id,
            user__isnull=False,
            user__is_active=True,
        )[:2].count()
        return count == 1

    def merge_to(from_org, to_org):
        from sentry.models import (
            ApiKey, AuditLogEntry, OrganizationMember, OrganizationMemberTeam,
            Project, Team
        )

        for from_member in OrganizationMember.objects.filter(organization=from_org):
            try:
                to_member = OrganizationMember.objects.get(
                    organization=to_org,
                    user=from_member.user,
                )
            except OrganizationMember.DoesNotExist:
                from_member.update(organization=to_org)
                to_member = from_member
            else:
                qs = OrganizationMemberTeam.objects.filter(
                    organizationmember=from_member,
                    is_active=True,
                ).select_related()
                for omt in qs:
                    OrganizationMemberTeam.objects.create_or_update(
                        organizationmember=to_member,
                        team=omt.team,
                        defaults={
                            'is_active': True,
                        },
                    )

        for team in Team.objects.filter(organization=from_org):
            try:
                with transaction.atomic():
                    team.update(organization=to_org)
            except IntegrityError:
                slugify_instance(team, team.name, organization=to_org)
                team.update(
                    organization=to_org,
                    slug=team.slug,
                )

        for project in Project.objects.filter(organization=from_org):
            try:
                with transaction.atomic():
                    project.update(organization=to_org)
            except IntegrityError:
                slugify_instance(project, project.name, organization=to_org)
                project.update(
                    organization=to_org,
                    slug=project.slug,
                )

        for model in (ApiKey, AuditLogEntry):
            model.objects.filter(
                organization=from_org,
            ).update(organization=to_org)

    # TODO: Make these a mixin
    def update_option(self, *args, **kwargs):
        from sentry.models import OrganizationOption

        return OrganizationOption.objects.set_value(self, *args, **kwargs)

    def get_option(self, *args, **kwargs):
        from sentry.models import OrganizationOption

        return OrganizationOption.objects.get_value(self, *args, **kwargs)

    def delete_option(self, *args, **kwargs):
        from sentry.models import OrganizationOption

        return OrganizationOption.objects.unset_value(self, *args, **kwargs)

    def send_delete_confirmation(self, audit_log_entry, countdown):
        from sentry import options
        from sentry.utils.email import MessageBuilder

        owners = self.get_owners()

        context = {
            'organization': self,
            'audit_log_entry': audit_log_entry,
            'eta': timezone.now() + timedelta(seconds=countdown),
            'url': absolute_uri(reverse(
                'sentry-restore-organization',
                args=[self.slug],
            )),
        }

        MessageBuilder(
            subject='%sOrganization Queued for Deletion' % (options.get('mail.subject-prefix'),),
            template='sentry/emails/org_delete_confirm.txt',
            html_template='sentry/emails/org_delete_confirm.html',
            type='org.confirm_delete',
            context=context,
        ).send_async([o.email for o in owners])
