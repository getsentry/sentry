import logging
from datetime import timedelta
from enum import IntEnum

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.urls import reverse
from django.utils import timezone
from django.utils.functional import cached_property

from bitfield import BitField
from sentry import roles
from sentry.app import locks
from sentry.constants import RESERVED_ORGANIZATION_SLUGS, RESERVED_PROJECT_SLUGS
from sentry.db.models import BaseManager, BoundedPositiveIntegerField, Model, sane_repr
from sentry.db.models.utils import slugify_instance
from sentry.utils.http import absolute_uri
from sentry.utils.retries import TimedRetryPolicy


class OrganizationStatus(IntEnum):
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2

    # alias
    VISIBLE = 0

    def __str__(self):
        return self.name

    @property
    def label(self):
        return OrganizationStatus._labels[self]

    @classmethod
    def as_choices(cls):
        result = []
        for name, member in cls.__members__.items():
            # an alias
            if name != member.name:
                continue
            # realistically Enum shouldn't even creating these, but alas
            if name.startswith("_"):
                continue
            result.append((member.value, str(member.label)))
        return tuple(result)


OrganizationStatus._labels = {
    OrganizationStatus.ACTIVE: "active",
    OrganizationStatus.PENDING_DELETION: "pending deletion",
    OrganizationStatus.DELETION_IN_PROGRESS: "deletion in progress",
}


class OrganizationManager(BaseManager):
    # def get_by_natural_key(self, slug):
    #     return self.get(slug=slug)

    def get_for_user(self, user, scope=None, only_visible=True):
        """
        Returns a set of all organizations a user has access to.
        """
        from sentry.models import OrganizationMember

        if not user.is_authenticated:
            return []

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(self.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(self.filter())

        qs = OrganizationMember.objects.filter(user=user).select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]
        return [r.organization for r in results]


class Organization(Model):
    """
    An organization represents a group of individuals which maintain ownership of projects.
    """

    __core__ = True
    name = models.CharField(max_length=64)
    slug = models.SlugField(unique=True)
    status = BoundedPositiveIntegerField(
        choices=OrganizationStatus.as_choices(), default=OrganizationStatus.ACTIVE.value
    )
    date_added = models.DateTimeField(default=timezone.now)
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="sentry.OrganizationMember",
        related_name="org_memberships",
        through_fields=("organization", "user"),
    )
    default_role = models.CharField(max_length=32, default=str(roles.get_default().id))

    flags = BitField(
        flags=(
            (
                "allow_joinleave",
                "Allow members to join and leave teams without requiring approval.",
            ),
            (
                "enhanced_privacy",
                "Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.",
            ),
            (
                "disable_shared_issues",
                "Disable sharing of limited details on issues to anonymous users.",
            ),
            (
                "early_adopter",
                "Enable early adopter status, gaining access to features prior to public release.",
            ),
            ("require_2fa", "Require and enforce two-factor authentication for all members."),
            (
                "disable_new_visibility_features",
                "Temporarily opt out of new visibility features and ui",
            ),
        ),
        default=1,
    )

    objects = OrganizationManager(cache_fields=("pk", "slug"))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organization"

    __repr__ = sane_repr("owner_id", "name", "slug")

    @classmethod
    def get_default(cls):
        """
        Return the organization used in single organization mode.
        """

        if settings.SENTRY_ORGANIZATION is not None:
            return cls.objects.get(id=settings.SENTRY_ORGANIZATION)

        return cls.objects.filter(status=OrganizationStatus.ACTIVE)[0]

    def __str__(self):
        return f"{self.name} ({self.slug})"

    def save(self, *args, **kwargs):
        if not self.slug:
            lock = locks.get("slug:organization", duration=5)
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_instance(self, self.name, reserved=RESERVED_ORGANIZATION_SLUGS)
            super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def delete(self, **kwargs):
        from sentry.models import NotificationSetting

        if self.is_default:
            raise Exception("You cannot delete the the default organization.")

        # There is no foreign key relationship so we have to manually cascade.
        NotificationSetting.objects.remove_for_organization(self)

        return super().delete(**kwargs)

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
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "status": int(self.status),
            "flags": int(self.flags),
            "default_role": self.default_role,
        }

    def get_owners(self):
        from sentry.models import User

        return User.objects.filter(
            sentry_orgmember_set__role=roles.get_top_dog().id,
            sentry_orgmember_set__organization=self,
            is_active=True,
        )

    def get_default_owner(self):
        if not hasattr(self, "_default_owner"):
            self._default_owner = self.get_owners()[0]
        return self._default_owner

    def has_single_owner(self):
        from sentry.models import OrganizationMember

        count = OrganizationMember.objects.filter(
            organization=self, role=roles.get_top_dog().id, user__isnull=False, user__is_active=True
        )[:2].count()
        return count == 1

    def merge_to(from_org, to_org):
        from sentry.models import (
            ApiKey,
            AuditLogEntry,
            AuthProvider,
            Commit,
            Environment,
            OrganizationAvatar,
            OrganizationIntegration,
            OrganizationMember,
            OrganizationMemberTeam,
            Project,
            Release,
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            ReleaseHeadCommit,
            Repository,
            Team,
        )

        for from_member in OrganizationMember.objects.filter(
            organization=from_org, user__isnull=False
        ):
            logger = logging.getLogger("sentry.merge")
            try:
                to_member = OrganizationMember.objects.get(
                    organization=to_org, user=from_member.user
                )
            except OrganizationMember.DoesNotExist:
                from_member.update(organization=to_org)
                to_member = from_member
            else:
                qs = OrganizationMemberTeam.objects.filter(
                    organizationmember=from_member, is_active=True
                ).select_related()
                for omt in qs:
                    OrganizationMemberTeam.objects.create_or_update(
                        organizationmember=to_member, team=omt.team, defaults={"is_active": True}
                    )
            logger.info(
                "user.migrate",
                extra={
                    "instance_id": from_member.id,
                    "new_member_id": to_member.id,
                    "from_organization_id": from_org.id,
                    "to_organization_id": to_org.id,
                },
            )

        for from_team in Team.objects.filter(organization=from_org):
            try:
                with transaction.atomic():
                    from_team.update(organization=to_org)
            except IntegrityError:
                slugify_instance(from_team, from_team.name, organization=to_org)
                from_team.update(organization=to_org, slug=from_team.slug)
            logger.info(
                "team.migrate",
                extra={
                    "instance_id": from_team.id,
                    "new_slug": from_team.slug,
                    "from_organization_id": from_org.id,
                    "to_organization_id": to_org.id,
                },
            )

        for from_project in Project.objects.filter(organization=from_org):
            try:
                with transaction.atomic():
                    from_project.update(organization=to_org)
            except IntegrityError:
                slugify_instance(
                    from_project,
                    from_project.name,
                    organization=to_org,
                    reserved=RESERVED_PROJECT_SLUGS,
                )
                from_project.update(organization=to_org, slug=from_project.slug)
            logger.info(
                "project.migrate",
                extra={
                    "instance_id": from_project.id,
                    "new_slug": from_project.slug,
                    "from_organization_id": from_org.id,
                    "to_organization_id": to_org.id,
                },
            )

        # TODO(jess): update this when adding unique constraint
        # on version, organization for releases
        for from_release in Release.objects.filter(organization=from_org):
            try:
                to_release = Release.objects.get(version=from_release.version, organization=to_org)
            except Release.DoesNotExist:
                Release.objects.filter(id=from_release.id).update(organization=to_org)
            else:
                Release.merge(to_release, [from_release])
            logger.info(
                "release.migrate",
                extra={
                    "instance_id": from_release.id,
                    "from_organization_id": from_org.id,
                    "to_organization_id": to_org.id,
                },
            )

        def do_update(queryset, params):
            model_name = queryset.model.__name__.lower()
            try:
                with transaction.atomic():
                    queryset.update(**params)
            except IntegrityError:
                for instance in queryset:
                    try:
                        with transaction.atomic():
                            instance.update(**params)
                    except IntegrityError:
                        logger.info(
                            f"{model_name}.migrate-skipped",
                            extra={
                                "from_organization_id": from_org.id,
                                "to_organization_id": to_org.id,
                            },
                        )
                    else:
                        logger.info(
                            f"{model_name}.migrate",
                            extra={
                                "instance_id": instance.id,
                                "from_organization_id": from_org.id,
                                "to_organization_id": to_org.id,
                            },
                        )
            else:
                logger.info(
                    f"{model_name}.migrate",
                    extra={"from_organization_id": from_org.id, "to_organization_id": to_org.id},
                )

        INST_MODEL_LIST = (
            AuthProvider,
            ApiKey,
            AuditLogEntry,
            OrganizationAvatar,
            OrganizationIntegration,
            ReleaseEnvironment,
            ReleaseFile,
        )

        ATTR_MODEL_LIST = (Commit, ReleaseCommit, ReleaseHeadCommit, Repository, Environment)

        for model in INST_MODEL_LIST:
            queryset = model.objects.filter(organization=from_org)
            do_update(queryset, {"organization": to_org})

        for model in ATTR_MODEL_LIST:
            queryset = model.objects.filter(organization_id=from_org.id)
            do_update(queryset, {"organization_id": to_org.id})

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
            "organization": self,
            "audit_log_entry": audit_log_entry,
            "eta": timezone.now() + timedelta(seconds=countdown),
            "url": absolute_uri(reverse("sentry-restore-organization", args=[self.slug])),
        }

        MessageBuilder(
            subject="{}Organization Queued for Deletion".format(options.get("mail.subject-prefix")),
            template="sentry/emails/org_delete_confirm.txt",
            html_template="sentry/emails/org_delete_confirm.html",
            type="org.confirm_delete",
            context=context,
        ).send_async([o.email for o in owners])

    def handle_2fa_required(self, request):
        from sentry.models import ApiKey
        from sentry.tasks.auth import remove_2fa_non_compliant_members

        actor_id = request.user.id if request.user and request.user.is_authenticated else None
        api_key_id = (
            request.auth.id
            if hasattr(request, "auth") and isinstance(request.auth, ApiKey)
            else None
        )
        ip_address = request.META["REMOTE_ADDR"]

        remove_2fa_non_compliant_members.delay(
            self.id, actor_id=actor_id, actor_key_id=api_key_id, ip_address=ip_address
        )

    def get_url_viewname(self):
        return "sentry-organization-issue-list"

    def get_url(self):
        return reverse(self.get_url_viewname(), args=[self.slug])
