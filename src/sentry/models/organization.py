from __future__ import annotations

from datetime import timedelta
from enum import IntEnum
from typing import Collection, FrozenSet, Optional, Sequence

from django.conf import settings
from django.db import models, router, transaction
from django.db.models import QuerySet
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from django.utils.functional import cached_property
from typing_extensions import override

from bitfield import TypedClassBitField
from sentry import features, roles
from sentry.app import env
from sentry.constants import (
    ALERTS_MEMBER_WRITE_DEFAULT,
    EVENTS_MEMBER_ADMIN_DEFAULT,
    RESERVED_ORGANIZATION_SLUGS,
)
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    Model,
    OptionManager,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.utils import slugify_instance
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.locks import locks
from sentry.models.options.option import OptionMixin
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox, outbox_context
from sentry.models.team import Team
from sentry.roles.manager import Role
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.organization import OrganizationAbsoluteUrlMixin
from sentry.utils.http import is_using_customer_domain
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.snowflake import SnowflakeIdMixin, generate_snowflake_id

SENTRY_USE_SNOWFLAKE = getattr(settings, "SENTRY_USE_SNOWFLAKE", False)
NON_MEMBER_SCOPES = frozenset(["org:write", "project:write", "team:write"])


class OrganizationStatus(IntEnum):
    ACTIVE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2

    # alias for OrganizationStatus.ACTIVE
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
    def get_for_user_ids(self, user_ids: Collection[int]) -> QuerySet:
        """Returns the QuerySet of all organizations that a set of Users have access to."""
        return self.filter(
            status=OrganizationStatus.ACTIVE,
            member_set__user_id__in=user_ids,
        )

    def get_for_team_ids(self, team_ids: Sequence[int]) -> QuerySet:
        """Returns the QuerySet of all organizations that a set of Teams have access to."""
        from sentry.models import Team

        return self.filter(
            status=OrganizationStatus.ACTIVE,
            id__in=Team.objects.filter(id__in=team_ids).values("organization"),
        )

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

        qs = OrganizationMember.objects.filter(user_id=user.id).select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]
        return [r.organization for r in results]

    def get_organizations_where_user_is_owner(self, user_id: int) -> QuerySet:
        """
        Returns a QuerySet of all organizations where a user has the top priority role.
        The default top priority role in Sentry is owner.
        """

        orgs = Organization.objects.filter(
            member_set__user_id=user_id,
            status=OrganizationStatus.ACTIVE,
        )

        # get owners from orgs
        owner_role_orgs = Organization.objects.filter(
            member_set__user_id=user_id,
            status=OrganizationStatus.ACTIVE,
            member_set__role=roles.get_top_dog().id,
        )

        # get owner teams
        owner_teams = Team.objects.filter(
            organization__in=orgs, org_role=roles.get_top_dog().id
        ).values_list("id", flat=True)

        # get the orgs in which the user is a member of an owner team
        owner_team_member_orgs = OrganizationMemberTeam.objects.filter(
            team_id__in=owner_teams
        ).values_list("organizationmember__organization_id", flat=True)

        # use .union() (UNION) as opposed to | (OR) because it's faster
        return self.filter(id__in=owner_team_member_orgs).union(owner_role_orgs)


@region_silo_only_model
class Organization(Model, OptionMixin, OrganizationAbsoluteUrlMixin, SnowflakeIdMixin):
    """
    An organization represents a group of individuals which maintain ownership of projects.
    """

    __include_in_export__ = True
    name = models.CharField(max_length=64)
    slug: models.SlugField[str, str] = models.SlugField(unique=True)
    status = BoundedPositiveIntegerField(
        choices=OrganizationStatus.as_choices(), default=OrganizationStatus.ACTIVE.value
    )
    date_added = models.DateTimeField(default=timezone.now)
    default_role = models.CharField(max_length=32, default=str(roles.get_default().id))
    is_test = models.BooleanField(default=False)

    class flags(TypedClassBitField):
        # Allow members to join and leave teams without requiring approval
        allow_joinleave: bool

        # Enable enhanced privacy controls to limit personally identifiable
        # information (PII) as well as source code in things like
        # notifications.
        enhanced_privacy: bool

        # Disable sharing of limited details on issues to anonymous users.
        disable_shared_issues: bool

        # Enable early adopter status, gaining access to features prior to public release.
        early_adopter: bool

        # Require and enforce two-factor authentication for all members.
        require_2fa: bool

        # Temporarily opt out of new visibility features and ui
        disable_new_visibility_features: bool

        # Require and enforce email verification for all members.
        require_email_verification: bool

        # Enable codecov integration.
        codecov_access: bool

        bitfield_default = 1

    objects = OrganizationManager(cache_fields=("pk", "slug"))

    # Not persisted. Getsentry fills this in in post-save hooks and we use it for synchronizing data across silos.
    customer_id: Optional[str] = None

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organization"
        # TODO: Once we're on a version of Django that supports functional indexes,
        # include index on `upper((slug::text))` here.

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

    snowflake_redis_key = "organization_snowflake_key"

    def save_with_update_outbox(self, *args, **kwargs):
        super().save(*args, **kwargs)
        Organization.outbox_for_update(self.id).save()

    def save(self, *args, **kwargs):
        slugify_target = None
        if not self.slug:
            slugify_target = self.name
        elif not self.id:
            slugify_target = self.slug
        if slugify_target is not None:
            lock = locks.get("slug:organization", duration=5, name="organization_slug")
            with TimedRetryPolicy(10)(lock.acquire):
                slugify_target = slugify_target.lower().replace("_", "-").strip("-")
                slugify_instance(self, slugify_target, reserved=RESERVED_ORGANIZATION_SLUGS)

        # Run the save + outbox queueing in a transaction to ensure the control-silo is notified
        # when a change is made to the organization model.
        if SENTRY_USE_SNOWFLAKE:
            self.save_with_snowflake_id(
                self.snowflake_redis_key,
                lambda: self.save_with_update_outbox(*args, **kwargs),
            )
        else:
            with outbox_context(transaction.atomic(using=router.db_for_write(Organization))):
                self.save_with_update_outbox(*args, **kwargs)

    # Override for the default update method to ensure that most atomic updates
    #  generate an outbox alongside any mutations to ensure data is replicated
    #  properly to the control silo.
    @override
    def update(self, *args, **kwargs):
        with outbox_context(transaction.atomic(router.db_for_write(Organization))):
            results = super().update(*args, **kwargs)
            Organization.outbox_for_update(self.id).save()
            return results

    @classmethod
    def reserve_snowflake_id(cls):
        return generate_snowflake_id(cls.snowflake_redis_key)

    def delete(self, **kwargs):
        from sentry.models import NotificationSetting

        if self.is_default:
            raise Exception("You cannot delete the the default organization.")

        # There is no foreign key relationship so we have to manually cascade.
        NotificationSetting.objects.remove_for_organization(self)

        with outbox_context(transaction.atomic(router.db_for_write(Organization)), flush=False):
            Organization.outbox_for_update(self.id).save()
            return super().delete(**kwargs)

    @staticmethod
    def outbox_for_update(org_id: int) -> RegionOutbox:
        return RegionOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=org_id,
            category=OutboxCategory.ORGANIZATION_UPDATE,
            object_identifier=org_id,
        )

    @cached_property
    def is_default(self):
        if not settings.SENTRY_SINGLE_ORGANIZATION:
            return False

        return self == type(self).get_default()

    def has_access(self, user: RpcUser, access=None):
        queryset = self.member_set.filter(user_id=user.id)
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

    def get_owners(self) -> Sequence[RpcUser]:
        owners = self.get_members_with_org_roles(roles=[roles.get_top_dog().id]).values_list(
            "user_id", flat=True
        )

        with in_test_hide_transaction_boundary():
            return user_service.get_many(filter={"user_ids": list(owners)})

    def get_default_owner(self) -> RpcUser:
        if not hasattr(self, "_default_owner"):
            self._default_owner = self.get_owners()[0]
        return self._default_owner

    @property
    def default_owner_id(self):
        """
        Similar to get_default_owner but won't raise a key error
        if there is no owner. Used for analytics primarily.
        """
        if not hasattr(self, "_default_owner_id"):
            owners = self.get_owners()
            if len(owners) == 0:
                return None
            self._default_owner_id = owners[0].id
        return self._default_owner_id

    def has_single_owner(self):
        owners = list(
            self.get_members_with_org_roles([roles.get_top_dog().id]).values_list("id", flat=True)
        )
        return len(owners[:2]) == 1

    def get_members_with_org_roles(
        self,
        roles: Collection[str],
        include_null_users: bool = False,
    ):
        members_with_role = self.member_set.filter(
            role__in=roles,
        )
        if not include_null_users:
            user_ids = members_with_role.filter(
                user_id__isnull=False, user_is_active=True
            ).values_list("user_id", flat=True)
            members_with_role = members_with_role.filter(user_id__in=user_ids)

        members_with_role = set(members_with_role.values_list("id", flat=True))

        teams_with_org_role = self.get_teams_with_org_roles(roles).values_list("id", flat=True)

        # may be empty
        members_on_teams_with_role = set(
            OrganizationMemberTeam.objects.filter(team_id__in=teams_with_org_role).values_list(
                "organizationmember__id", flat=True
            )
        )

        # use union of sets because a subset may be empty
        return OrganizationMember.objects.filter(
            id__in=members_with_role.union(members_on_teams_with_role)
        )

    @property
    def option_manager(self) -> OptionManager:
        from sentry.models import OrganizationOption

        return OrganizationOption.objects

    def send_delete_confirmation(self, audit_log_entry, countdown):
        from sentry import options
        from sentry.utils.email import MessageBuilder

        owners = self.get_owners()
        url = self.absolute_url(reverse("sentry-restore-organization", args=[self.slug]))

        context = {
            "organization": self,
            "audit_log_entry": audit_log_entry,
            "eta": timezone.now() + timedelta(seconds=countdown),
            "url": url,
        }

        MessageBuilder(
            subject="{}Organization Queued for Deletion".format(options.get("mail.subject-prefix")),
            template="sentry/emails/org_delete_confirm.txt",
            html_template="sentry/emails/org_delete_confirm.html",
            type="org.confirm_delete",
            context=context,
        ).send_async([o.email for o in owners])

    def _handle_requirement_change(self, request, task):
        from sentry.models.apikey import is_api_key_auth

        actor_id = request.user.id if request.user and request.user.is_authenticated else None
        api_key_id = (
            request.auth.id if hasattr(request, "auth") and is_api_key_auth(request.auth) else None
        )
        ip_address = request.META["REMOTE_ADDR"]

        task.delay(self.id, actor_id=actor_id, actor_key_id=api_key_id, ip_address=ip_address)

    def handle_2fa_required(self, request):
        from sentry.tasks.auth import remove_2fa_non_compliant_members

        self._handle_requirement_change(request, remove_2fa_non_compliant_members)

    def handle_email_verification_required(self, request):
        from sentry.tasks.auth import remove_email_verification_non_compliant_members

        if features.has("organizations:required-email-verification", self):
            self._handle_requirement_change(
                request, remove_email_verification_non_compliant_members
            )

    @staticmethod
    def get_url_viewname() -> str:
        """
        Get the default view name for an organization taking customer-domains into account.
        """
        request = env.request
        if request and is_using_customer_domain(request):
            return "issues"
        return "sentry-organization-issue-list"

    @staticmethod
    def get_url(slug: str) -> str:
        """
        Get a relative URL to the organization's issue list with `slug`
        """
        try:
            return reverse(Organization.get_url_viewname(), args=[slug])
        except NoReverseMatch:
            return reverse(Organization.get_url_viewname())

    def get_scopes(self, role: Role) -> FrozenSet[str]:
        """
        Note that scopes for team-roles are filtered through this method too.
        """
        if bool(NON_MEMBER_SCOPES & role.scopes):
            return role.scopes

        scopes = set(role.scopes)
        if not self.get_option("sentry:events_member_admin", EVENTS_MEMBER_ADMIN_DEFAULT):
            scopes.discard("event:admin")
        if not self.get_option("sentry:alerts_member_write", ALERTS_MEMBER_WRITE_DEFAULT):
            scopes.discard("alerts:write")
        return frozenset(scopes)

    def get_teams_with_org_roles(self, roles: Optional[Collection[str]]) -> QuerySet:
        from sentry.models.team import Team

        if roles is not None:
            return Team.objects.filter(org_role__in=roles, organization=self)

        return Team.objects.filter(organization=self).exclude(org_role=None)
